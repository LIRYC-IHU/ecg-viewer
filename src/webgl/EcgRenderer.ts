import type {
  AmplitudeScale,
  Caliper,
  EcgRecord,
  Layout,
  TimeScale,
  ViewerOptions,
} from '../types';
import {
  compileProgram,
  FS_SOURCE,
  VS_SOURCE,
} from './shaders';
import { readTheme, withAlpha, type Theme } from './theme';
import {
  getLayoutGrid,
  LEAD_NAMES,
  layoutLabel,
  type LayoutGrid,
} from './layouts';

/** CSS pixels per millimeter at the reference 96 DPI. */
const CSS_PX_PER_MM = 96 / 25.4;

/** Pixel cap fallback when WebGL doesn't report a sensible limit. */
const DEFAULT_MAX_INTERNAL_PX = 16384;

/** Caliper end-bar lengths are now full-canvas so this lives in the shader. */

export interface RenderInfo {
  /** On-screen mm/s after fit-to-window and zoom. */
  effectiveTimeScale: number;
  /** On-screen mm/mV after fit-to-window and zoom. */
  effectiveAmplitudeScale: number;
  /** Total CSS scale factor (1 = exact 96-DPI mm). */
  fitScale: number;
  cssWidth: number;
  cssHeight: number;
}

export type LabelHit =
  | { kind: 'lead'; leadIndex: number }
  | { kind: 'cycleTime' }
  | { kind: 'cycleAmp' }
  | { kind: 'cycleLayout' };

export interface RenderDecoration {
  calipers?: Caliper[];
  preview?: Caliper | null;
  hoveredCaliperId?: string | null;
  /** Cursor position in canvas-mm; drawn as a dashed vertical guideline. */
  crosshair?: { x: number; y: number } | null;
}

interface HitRect {
  x: number; y: number; w: number; h: number;
  hit: LabelHit;
}

interface CaliperHitRect {
  x: number; y: number; w: number; h: number;
  id: string;
}

interface OverlayParams {
  cssWidth: number;
  cssHeight: number;
  dpr: number;
  theme: Theme;
  grid: LayoutGrid;
  layout: Layout;
  leftMarginMm: number;
  topMarginMm: number;
  rowHeightMm: number;
  segWidthMm: number;
  labelWidthMm: number;
  pxPerMm: number;
  timeScale: TimeScale;
  amplitudeScale: AmplitudeScale;
  hasRhythmStrip: boolean;
  rhythmLead: number;
  rhythmBaselineY: number | null;
  rhythmOriginX: number;
  rhythmRowMm: number;
  /** Total plot height (main rows + rhythm gap + rhythm row) in mm. */
  plotHeightMm: number;
  calipers: Caliper[];
  previewCaliper: Caliper | null;
  hoveredCaliperId: string | null;
  crosshair: { x: number; y: number } | null;
}

/**
 * Renders a 12-lead ECG into a pair of canvases:
 *   - a WebGL canvas with the trace polylines (TRIANGLE_STRIP with miter join)
 *   - a 2D-canvas overlay with the grid, labels, chips and caliper markings
 *
 * Theming (colors, trace thickness) is read live from CSS custom properties on
 * a host element. Everything else (layout, scales, rhythm strip) is controlled
 * through `ViewerOptions` passed via `setOptions` + `render`.
 */
export class EcgRenderer {
  private gl: WebGLRenderingContext;
  private overlayCtx: CanvasRenderingContext2D;
  private program: WebGLProgram;
  private locs: {
    a_pos: number;
    a_prev: number;
    a_next: number;
    a_side: number;
    u_timeOffsetSec: WebGLUniformLocation;
    u_pxPerSec: WebGLUniformLocation;
    u_pxPerMv: WebGLUniformLocation;
    u_originX: WebGLUniformLocation;
    u_baselineY: WebGLUniformLocation;
    u_canvasSizePx: WebGLUniformLocation;
    u_thicknessPx: WebGLUniformLocation;
    u_color: WebGLUniformLocation;
  };
  /** Per-channel expanded vertex buffer (2N vertices × 7 floats). */
  private buffers: Array<{ buf: WebGLBuffer; n: number } | null> = [];
  private record: EcgRecord | null = null;
  private options: ViewerOptions;
  private lastInfo: RenderInfo | null = null;
  private hits: HitRect[] = [];
  private caliperHits: CaliperHitRect[] = [];
  /** Stored each render() so screen↔canvas-mm conversion works post-render. */
  private lastPxPerMm: number = CSS_PX_PER_MM;
  /** Hard cap on canvas internal pixels along one axis (driver/GPU limit). */
  private maxInternalPx: number = DEFAULT_MAX_INTERNAL_PX;

  constructor(
    private glCanvas: HTMLCanvasElement,
    private overlayCanvas: HTMLCanvasElement,
    /** Element to read theme CSS variables from. */
    private themeHost: HTMLElement,
    options: ViewerOptions,
  ) {
    const gl = glCanvas.getContext('webgl', {
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: true,
      premultipliedAlpha: false,
    });
    if (!gl) throw new Error('WebGL non disponible sur ce navigateur.');
    this.gl = gl;
    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D non disponible.');
    this.overlayCtx = ctx;
    this.options = options;

    this.program = compileProgram(gl, VS_SOURCE, FS_SOURCE);
    gl.useProgram(this.program);
    this.locs = {
      a_pos: gl.getAttribLocation(this.program, 'a_pos'),
      a_prev: gl.getAttribLocation(this.program, 'a_prev'),
      a_next: gl.getAttribLocation(this.program, 'a_next'),
      a_side: gl.getAttribLocation(this.program, 'a_side'),
      u_timeOffsetSec: gl.getUniformLocation(this.program, 'u_timeOffsetSec')!,
      u_pxPerSec: gl.getUniformLocation(this.program, 'u_pxPerSec')!,
      u_pxPerMv: gl.getUniformLocation(this.program, 'u_pxPerMv')!,
      u_originX: gl.getUniformLocation(this.program, 'u_originX')!,
      u_baselineY: gl.getUniformLocation(this.program, 'u_baselineY')!,
      u_canvasSizePx: gl.getUniformLocation(this.program, 'u_canvasSizePx')!,
      u_thicknessPx: gl.getUniformLocation(this.program, 'u_thicknessPx')!,
      u_color: gl.getUniformLocation(this.program, 'u_color')!,
    };

    // GPU limits — sampled once so we never request a canvas the driver will
    // silently clamp (which would shift the trace vs the overlay).
    const maxViewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array | null;
    const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    this.maxInternalPx = Math.max(
      1024,
      Math.min(
        maxViewport ? Math.min(maxViewport[0], maxViewport[1]) : DEFAULT_MAX_INTERNAL_PX,
        typeof maxTex === 'number' && maxTex > 0 ? maxTex : DEFAULT_MAX_INTERNAL_PX,
      ),
    );
  }

  setData(record: EcgRecord): void {
    const gl = this.gl;
    for (const b of this.buffers) if (b) gl.deleteBuffer(b.buf);
    this.buffers = [];
    this.record = record;

    const dt = 1 / record.samplingFrequency;
    for (const ch of record.channels) {
      const n = ch.samples.length;
      // 2N vertices × 7 floats: a_pos.xy, a_prev.xy, a_next.xy, a_side
      const data = new Float32Array(n * 2 * 7);
      for (let i = 0; i < n; i++) {
        const t = i * dt;
        const v = ch.samples[i];
        const tPrev = i > 0 ? (i - 1) * dt : t;
        const vPrev = i > 0 ? ch.samples[i - 1] : v;
        const tNext = i < n - 1 ? (i + 1) * dt : t;
        const vNext = i < n - 1 ? ch.samples[i + 1] : v;
        for (let s = 0; s < 2; s++) {
          const off = (i * 2 + s) * 7;
          data[off + 0] = t;
          data[off + 1] = v;
          data[off + 2] = tPrev;
          data[off + 3] = vPrev;
          data[off + 4] = tNext;
          data[off + 5] = vNext;
          data[off + 6] = s === 0 ? 1 : -1;
        }
      }
      const buf = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      this.buffers.push({ buf, n });
    }
  }

  setOptions(options: ViewerOptions): void {
    this.options = options;
  }

  getLastInfo(): RenderInfo | null {
    return this.lastInfo;
  }

  hitTest(cssX: number, cssY: number): LabelHit | null {
    for (const h of this.hits) {
      if (cssX >= h.x && cssX < h.x + h.w && cssY >= h.y && cssY < h.y + h.h) {
        return h.hit;
      }
    }
    return null;
  }

  hitTestCaliperLabel(cssX: number, cssY: number): string | null {
    for (let i = this.caliperHits.length - 1; i >= 0; i--) {
      const r = this.caliperHits[i];
      if (cssX >= r.x && cssX < r.x + r.w && cssY >= r.y && cssY < r.y + r.h) {
        return r.id;
      }
    }
    return null;
  }

  cssToCanvasMm(cssX: number, cssY: number): { x: number; y: number } {
    return { x: cssX / this.lastPxPerMm, y: cssY / this.lastPxPerMm };
  }

  render(
    containerCssWidth: number,
    containerCssHeight: number,
    zoom = 1,
    deco: RenderDecoration = {},
  ): RenderInfo | null {
    if (!this.record) return null;
    const { layout, timeScale, amplitudeScale, rhythmLead } = this.options;
    const grid = getLayoutGrid(layout);
    const hasRhythmStrip = layout === '6x2' || layout === '3x4';
    const theme = readTheme(this.themeHost);

    // --- Geometry in millimeters ---
    // Page height is locked to the 10 mm/mV reference so changing amplitude
    // never resizes the page nor shifts row baselines. Columns are edge-to-
    // edge (colGapMm = 0) so they remain temporally aligned with the rhythm
    // strip below; the join is marked by per-row "¦" separators.
    const segDurationSec = this.record.durationSec / grid.cols;
    const REFERENCE_AMP_MM_PER_MV = 10;
    const referenceRowMm = REFERENCE_AMP_MM_PER_MV * 2;
    const targetPlotHeightMm = 7 * referenceRowMm;

    const labelWidthMm = 10;
    const leftMarginMm = labelWidthMm + 3;
    const rightMarginMm = 5;
    const topMarginMm = 8;
    const bottomMarginMm = 7;
    const rhythmGapMm = hasRhythmStrip ? 5 : 0;
    const totalRowsLogical = hasRhythmStrip ? grid.rows + 1 : grid.rows;
    const rowHeightMm = (targetPlotHeightMm - rhythmGapMm) / totalRowsLogical;
    const rhythmRowMm = hasRhythmStrip ? rowHeightMm : 0;

    const segWidthMm = segDurationSec * timeScale;
    const plotWidthMm = grid.cols * segWidthMm;
    const plotHeightMm = grid.rows * rowHeightMm + rhythmGapMm + rhythmRowMm;

    const idealWidthMm = leftMarginMm + plotWidthMm + rightMarginMm;
    const idealHeightMm = topMarginMm + plotHeightMm + bottomMarginMm;

    const idealCssWidth = idealWidthMm * CSS_PX_PER_MM;
    const idealCssHeight = idealHeightMm * CSS_PX_PER_MM;

    // Fit-best to container, allowing both shrink AND grow.
    const baseFitScale = Math.min(
      containerCssWidth / idealCssWidth,
      containerCssHeight / idealCssHeight,
    );
    const fitScale = baseFitScale * zoom;
    const cssWidth = Math.max(1, idealCssWidth * fitScale);
    const cssHeight = Math.max(1, idealCssHeight * fitScale);

    // Cap the effective DPR so we never exceed the GPU limits (which would
    // silently clamp canvas.width while leaving gl.viewport oversized and
    // shift the rendered trace).
    const rawDpr = window.devicePixelRatio || 1;
    const dprCapByW = this.maxInternalPx / cssWidth;
    const dprCapByH = this.maxInternalPx / cssHeight;
    const dpr = Math.max(1, Math.min(rawDpr, dprCapByW, dprCapByH));

    sizeCanvas(this.glCanvas, cssWidth, cssHeight, dpr);
    sizeCanvas(this.overlayCanvas, cssWidth, cssHeight, dpr);

    const pxPerMm = CSS_PX_PER_MM * fitScale;
    const pxPerSec = timeScale * pxPerMm;
    const pxPerMv = amplitudeScale * pxPerMm;
    this.lastPxPerMm = pxPerMm;

    const rhythmBaselineY = hasRhythmStrip
      ? (topMarginMm + grid.rows * rowHeightMm + rhythmGapMm + rhythmRowMm / 2) *
        pxPerMm
      : null;
    const rhythmOriginX = leftMarginMm * pxPerMm;

    // --- 2D overlay: background, grid, labels, chips, calipers ---
    this.drawOverlay({
      cssWidth, cssHeight, dpr, theme, grid, layout,
      leftMarginMm, topMarginMm, rowHeightMm, segWidthMm,
      labelWidthMm,
      pxPerMm,
      timeScale, amplitudeScale,
      hasRhythmStrip, rhythmLead,
      rhythmBaselineY, rhythmOriginX, rhythmRowMm,
      plotHeightMm,
      calipers: deco.calipers ?? [],
      previewCaliper: deco.preview ?? null,
      hoveredCaliperId: deco.hoveredCaliperId ?? null,
      crosshair: deco.crosshair ?? null,
    });

    // --- WebGL: traces ---
    const gl = this.gl;
    // Use drawingBuffer dims (not canvas.width) so the viewport always matches
    // the actually-allocated GPU buffer.
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.uniform2f(this.locs.u_canvasSizePx, cssWidth, cssHeight);
    gl.uniform1f(this.locs.u_pxPerSec, pxPerSec);
    gl.uniform1f(this.locs.u_pxPerMv, pxPerMv);
    gl.uniform1f(this.locs.u_thicknessPx, theme.traceThicknessPx);
    gl.uniform3f(this.locs.u_color, theme.trace[0], theme.trace[1], theme.trace[2]);

    for (let row = 0; row < grid.rows; row++) {
      const baselineY = (topMarginMm + (row + 0.5) * rowHeightMm) * pxPerMm;
      for (let col = 0; col < grid.cols; col++) {
        const leadIdx = grid.leadIndex[row][col];
        if (leadIdx < 0) continue;
        this.drawTraceSegment({
          leadIdx,
          startSec: col * segDurationSec,
          durationSec: segDurationSec,
          originX: (leftMarginMm + col * segWidthMm) * pxPerMm,
          baselineY,
        });
      }
    }

    if (hasRhythmStrip && rhythmBaselineY !== null && rhythmLead >= 0 && rhythmLead < 12) {
      this.drawTraceSegment({
        leadIdx: rhythmLead,
        startSec: 0,
        durationSec: this.record.durationSec,
        originX: rhythmOriginX,
        baselineY: rhythmBaselineY,
      });
    }

    this.lastInfo = {
      effectiveTimeScale: timeScale * fitScale,
      effectiveAmplitudeScale: amplitudeScale * fitScale,
      fitScale,
      cssWidth,
      cssHeight,
    };
    return this.lastInfo;
  }

  exportPng(): string {
    const out = document.createElement('canvas');
    out.width = this.glCanvas.width;
    out.height = this.glCanvas.height;
    const ctx = out.getContext('2d')!;
    ctx.drawImage(this.overlayCanvas, 0, 0);
    ctx.drawImage(this.glCanvas, 0, 0);
    return out.toDataURL('image/png');
  }

  dispose(): void {
    const gl = this.gl;
    for (const b of this.buffers) if (b) gl.deleteBuffer(b.buf);
    this.buffers = [];
    gl.deleteProgram(this.program);
  }

  // ---------- Private ----------

  private drawTraceSegment(p: {
    leadIdx: number;
    startSec: number;
    durationSec: number;
    originX: number;
    baselineY: number;
  }) {
    if (!this.record) return;
    const gl = this.gl;
    const buf = this.buffers[p.leadIdx];
    if (!buf) return;

    gl.uniform1f(this.locs.u_originX, p.originX);
    gl.uniform1f(this.locs.u_baselineY, p.baselineY);
    gl.uniform1f(this.locs.u_timeOffsetSec, p.startSec);

    gl.bindBuffer(gl.ARRAY_BUFFER, buf.buf);
    const stride = 7 * 4;
    bindAttr(gl, this.locs.a_pos, 2, stride, 0);
    bindAttr(gl, this.locs.a_prev, 2, stride, 2 * 4);
    bindAttr(gl, this.locs.a_next, 2, stride, 4 * 4);
    bindAttr(gl, this.locs.a_side, 1, stride, 6 * 4);

    const fs = this.record.samplingFrequency;
    const startSample = Math.max(0, Math.floor(p.startSec * fs));
    const endSampleExclusive = Math.min(
      buf.n,
      Math.ceil((p.startSec + p.durationSec) * fs) + 1,
    );
    const count = Math.max(0, endSampleExclusive - startSample);
    if (count >= 2) {
      gl.drawArrays(gl.TRIANGLE_STRIP, startSample * 2, count * 2);
    }
  }

  private drawOverlay(p: OverlayParams) {
    const ctx = this.overlayCtx;
    const { cssWidth, cssHeight, dpr, theme, grid } = p;
    this.hits = [];
    this.caliperHits = [];

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    const pxPerMm = p.pxPerMm;
    this.drawGrid(ctx, cssWidth, cssHeight, pxPerMm, theme);
    this.drawColumnSeparators(ctx, p);

    const fontPx = Math.max(10, Math.min(16, p.rowHeightMm * pxPerMm * 0.22));
    this.drawLeadLabels(ctx, p, fontPx);
    this.drawRhythmStripLabel(ctx, p, fontPx);
    this.drawLayoutChip(ctx, p, fontPx);
    this.drawScaleChips(ctx, p, fontPx);

    if (p.crosshair) {
      this.drawCrosshair(ctx, p.crosshair, p);
    }

    for (const c of p.calipers) {
      this.drawCaliper(ctx, c, pxPerMm, cssWidth, cssHeight, theme,
        p.timeScale, p.amplitudeScale,
        c.id === p.hoveredCaliperId, false);
    }
    if (p.previewCaliper) {
      this.drawCaliper(ctx, p.previewCaliper, pxPerMm, cssWidth, cssHeight, theme,
        p.timeScale, p.amplitudeScale, false, true);
    }
  }

  private drawCrosshair(
    ctx: CanvasRenderingContext2D,
    crosshair: { x: number; y: number },
    p: OverlayParams,
  ) {
    const minX = p.leftMarginMm;
    const maxX = p.leftMarginMm + p.grid.cols * p.segWidthMm;
    if (crosshair.x < minX || crosshair.x > maxX) return;
    const xPx = Math.round(crosshair.x * p.pxPerMm) + 0.5;
    ctx.save();
    ctx.strokeStyle = p.theme.accent;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(xPx, 0);
    ctx.lineTo(xPx, p.cssHeight);
    ctx.stroke();
    ctx.restore();
  }

  private drawGrid(
    ctx: CanvasRenderingContext2D,
    cssWidth: number, cssHeight: number, pxPerMm: number, theme: Theme,
  ) {
    const drawLines = (stepMm: number, color: string, width: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      const stepPx = stepMm * pxPerMm;
      for (let x = 0; x <= cssWidth + 0.5; x += stepPx) {
        const xx = Math.round(x) + 0.5;
        ctx.moveTo(xx, 0); ctx.lineTo(xx, cssHeight);
      }
      for (let y = 0; y <= cssHeight + 0.5; y += stepPx) {
        const yy = Math.round(y) + 0.5;
        ctx.moveTo(0, yy); ctx.lineTo(cssWidth, yy);
      }
      ctx.stroke();
    };
    drawLines(1, theme.gridMinor, 0.5);
    drawLines(5, theme.gridMajor, 0.9);
  }

  private drawColumnSeparators(ctx: CanvasRenderingContext2D, p: OverlayParams) {
    if (p.grid.cols <= 1) return;
    const pxPerMm = p.pxPerMm;
    // Broken-bar (¦) marks: total length ≈ rowHeight / 4, centered on each
    // row's baseline. One mark at every column join, every row.
    const markTotalMm = p.rowHeightMm / 4;
    const gapMm = markTotalMm / 4;
    const halfBarPx = ((markTotalMm - gapMm) / 2) * pxPerMm;
    const halfGapPx = (gapMm / 2) * pxPerMm;
    ctx.strokeStyle = p.theme.label;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let col = 1; col < p.grid.cols; col++) {
      const xMm = p.leftMarginMm + col * p.segWidthMm;
      const x = Math.round(xMm * pxPerMm) + 0.5;
      for (let row = 0; row < p.grid.rows; row++) {
        const baselineY = (p.topMarginMm + (row + 0.5) * p.rowHeightMm) * pxPerMm;
        ctx.moveTo(x, baselineY - halfGapPx - halfBarPx);
        ctx.lineTo(x, baselineY - halfGapPx);
        ctx.moveTo(x, baselineY + halfGapPx);
        ctx.lineTo(x, baselineY + halfGapPx + halfBarPx);
      }
    }
    ctx.stroke();
  }

  private drawLeadLabels(
    ctx: CanvasRenderingContext2D, p: OverlayParams, fontPx: number,
  ) {
    ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    for (let row = 0; row < p.grid.rows; row++) {
      const baselineY = (p.topMarginMm + (row + 0.5) * p.rowHeightMm) * p.pxPerMm;
      for (let col = 0; col < p.grid.cols; col++) {
        const leadIdx = p.grid.leadIndex[row][col];
        if (leadIdx < 0) continue;
        const cellOriginX = (p.leftMarginMm + col * p.segWidthMm) * p.pxPerMm;
        const labelX = cellOriginX - p.labelWidthMm * p.pxPerMm;
        const labelY = baselineY - p.rowHeightMm * p.pxPerMm * 0.35;
        const isRhythm = p.hasRhythmStrip && leadIdx === p.rhythmLead;
        this.drawLeadLabelText(ctx, LEAD_NAMES[leadIdx], labelX, labelY, fontPx, {
          color: isRhythm ? p.theme.accent : p.theme.label,
          underline: isRhythm,
        });
        const m = ctx.measureText(LEAD_NAMES[leadIdx]);
        const padX = 4, padY = 6;
        this.hits.push({
          x: labelX - padX,
          y: labelY - fontPx / 2 - padY,
          w: Math.max(m.width, p.labelWidthMm * p.pxPerMm) + 2 * padX,
          h: fontPx + 2 * padY,
          hit: { kind: 'lead', leadIndex: leadIdx },
        });
      }
    }
  }

  private drawRhythmStripLabel(
    ctx: CanvasRenderingContext2D, p: OverlayParams, fontPx: number,
  ) {
    if (!p.hasRhythmStrip || p.rhythmBaselineY === null) return;
    if (p.rhythmLead < 0 || p.rhythmLead >= 12) return;
    const baselineY = p.rhythmBaselineY;
    const labelX = p.rhythmOriginX - p.labelWidthMm * p.pxPerMm;
    const labelY = baselineY - p.rhythmRowMm * p.pxPerMm * 0.35;
    this.drawLeadLabelText(ctx, LEAD_NAMES[p.rhythmLead], labelX, labelY, fontPx, {
      color: p.theme.accent,
      underline: false,
      bold: true,
      prefix: '▸ ',
    });
    const m = ctx.measureText(`▸ ${LEAD_NAMES[p.rhythmLead]}`);
    const padX = 4, padY = 6;
    this.hits.push({
      x: labelX - padX,
      y: labelY - fontPx / 2 - padY,
      w: Math.max(m.width, p.labelWidthMm * p.pxPerMm) + 2 * padX,
      h: fontPx + 2 * padY,
      hit: { kind: 'lead', leadIndex: p.rhythmLead },
    });
  }

  private drawLayoutChip(
    ctx: CanvasRenderingContext2D, p: OverlayParams, fontPx: number,
  ) {
    const text = layoutLabel(p.layout);
    const chip = this.drawChip(ctx, {
      text, x: 6, y: 6,
      fontPx: Math.max(10, fontPx * 0.85),
      textColor: p.theme.label,
      bg: p.theme.chipBg, border: p.theme.chipBorder,
    });
    this.hits.push({ ...chip, hit: { kind: 'cycleLayout' } });
  }

  private drawScaleChips(
    ctx: CanvasRenderingContext2D, p: OverlayParams, fontPx: number,
  ) {
    const fontMain = Math.max(10, fontPx * 0.85);
    const ampText = `${p.amplitudeScale} mm/mV`;
    const timeText = `${p.timeScale} mm/s`;

    ctx.font = `600 ${fontMain}px system-ui, sans-serif`;
    const ampWidth = ctx.measureText(ampText).width + 16;
    const timeWidth = ctx.measureText(timeText).width + 16;
    const chipHeight = fontMain + 10;
    const margin = 6, gap = 6;

    const ampX = p.cssWidth - margin - ampWidth;
    const ampY = p.cssHeight - margin - chipHeight;
    const ampChip = this.drawChip(ctx, {
      text: ampText, x: ampX, y: ampY,
      fontPx: fontMain, textColor: p.theme.label,
      bg: p.theme.chipBg, border: p.theme.chipBorder,
      widthOverride: ampWidth,
    });
    this.hits.push({ ...ampChip, hit: { kind: 'cycleAmp' } });

    const timeX = ampX - gap - timeWidth;
    const timeChip = this.drawChip(ctx, {
      text: timeText, x: timeX, y: ampY,
      fontPx: fontMain, textColor: p.theme.label,
      bg: p.theme.chipBg, border: p.theme.chipBorder,
      widthOverride: timeWidth,
    });
    this.hits.push({ ...timeChip, hit: { kind: 'cycleTime' } });
  }

  private drawCaliper(
    ctx: CanvasRenderingContext2D,
    c: Caliper,
    pxPerMm: number,
    cssWidth: number,
    cssHeight: number,
    theme: Theme,
    timeScale: TimeScale,
    amplitudeScale: AmplitudeScale,
    isHovered: boolean,
    isPreview: boolean,
  ) {
    const sx = c.startXmm * pxPerMm;
    const sy = c.startYmm * pxPerMm;
    const ex = c.endXmm * pxPerMm;
    const ey = c.endYmm * pxPerMm;

    ctx.save();
    if (isPreview) ctx.globalAlpha = 0.7;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    let text: string;
    let labelAnchor: { x: number; y: number; side: 'top' | 'right' };

    if (c.mode === 'time') {
      const midY = (sy + ey) / 2;
      ctx.moveTo(sx, 0); ctx.lineTo(sx, cssHeight);
      ctx.moveTo(ex, 0); ctx.lineTo(ex, cssHeight);
      ctx.moveTo(sx, midY); ctx.lineTo(ex, midY);
      ctx.stroke();
      const deltaMs = Math.abs(c.endXmm - c.startXmm) / timeScale * 1000;
      text = `${deltaMs.toFixed(0)} ms`;
      labelAnchor = { x: (sx + ex) / 2, y: midY, side: 'top' };
    } else {
      const midX = (sx + ex) / 2;
      ctx.moveTo(0, sy); ctx.lineTo(cssWidth, sy);
      ctx.moveTo(0, ey); ctx.lineTo(cssWidth, ey);
      ctx.moveTo(midX, sy); ctx.lineTo(midX, ey);
      ctx.stroke();
      const deltaMv = Math.abs(c.endYmm - c.startYmm) / amplitudeScale;
      text = `${deltaMv.toFixed(2)} mV`;
      labelAnchor = { x: midX, y: (sy + ey) / 2, side: 'right' };
    }

    // Label chip
    const fontPx = 12;
    ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
    const textW = ctx.measureText(text).width;
    const padX = 6, padY = 4;
    const w = textW + 2 * padX;
    const h = fontPx + 2 * padY;
    let rectX: number, rectY: number;
    if (labelAnchor.side === 'top') {
      rectX = labelAnchor.x - w / 2;
      rectY = labelAnchor.y - h - 2;
    } else {
      rectX = labelAnchor.x + 4;
      rectY = labelAnchor.y - h / 2;
    }

    ctx.fillStyle = isHovered ? withAlpha(theme.accent, 0.18) : theme.chipBg;
    ctx.strokeStyle = isHovered ? theme.accent : theme.chipBorder;
    ctx.lineWidth = isHovered ? 1.2 : 1;
    roundRect(ctx, rectX + 0.5, rectY + 0.5, w - 1, h - 1, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = theme.accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, rectX + w / 2, rectY + h / 2);

    ctx.restore();

    if (!isPreview) {
      this.caliperHits.push({ x: rectX, y: rectY, w, h, id: c.id });
    }
  }

  private drawLeadLabelText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    fontPx: number,
    opts: { color: string; underline: boolean; bold?: boolean; prefix?: string },
  ) {
    ctx.fillStyle = opts.color;
    ctx.font = `${opts.bold ? 700 : 600} ${fontPx}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const full = (opts.prefix ?? '') + text;
    ctx.fillText(full, x, y);
    if (opts.underline) {
      const m = ctx.measureText(full);
      ctx.strokeStyle = opts.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + fontPx / 2 + 1);
      ctx.lineTo(x + m.width, y + fontPx / 2 + 1);
      ctx.stroke();
    }
  }

  private drawChip(
    ctx: CanvasRenderingContext2D,
    p: {
      text: string;
      x: number;
      y: number;
      fontPx: number;
      textColor: string;
      bg: string;
      border: string;
      widthOverride?: number;
    },
  ): { x: number; y: number; w: number; h: number } {
    ctx.font = `600 ${p.fontPx}px system-ui, sans-serif`;
    const padX = 8, padY = 5;
    const textW = ctx.measureText(p.text).width;
    const w = p.widthOverride ?? textW + 2 * padX;
    const h = p.fontPx + 2 * padY;
    const r = 4;
    ctx.fillStyle = p.bg;
    ctx.strokeStyle = p.border;
    ctx.lineWidth = 1;
    roundRect(ctx, p.x + 0.5, p.y + 0.5, w - 1, h - 1, r);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = p.textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.text, p.x + w / 2, p.y + h / 2);
    return { x: p.x, y: p.y, w, h };
  }
}

// ---------- Module-private helpers ----------

function bindAttr(
  gl: WebGLRenderingContext,
  loc: number,
  size: number,
  stride: number,
  offset: number,
) {
  if (loc < 0) return;
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function sizeCanvas(c: HTMLCanvasElement, cssWidth: number, cssHeight: number, dpr: number) {
  c.style.width = cssWidth + 'px';
  c.style.height = cssHeight + 'px';
  const w = Math.round(cssWidth * dpr);
  const h = Math.round(cssHeight * dpr);
  if (c.width !== w) c.width = w;
  if (c.height !== h) c.height = h;
}
