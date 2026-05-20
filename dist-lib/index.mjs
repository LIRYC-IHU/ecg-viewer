var ke = Object.defineProperty;
var De = (s, e, t) => e in s ? ke(s, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : s[e] = t;
var H = (s, e, t) => De(s, typeof e != "symbol" ? e + "" : e, t);
import { jsxs as J, jsx as re } from "react/jsx-runtime";
import { forwardRef as Xe, useState as ne, useRef as k, useEffect as R, useCallback as F, useImperativeHandle as Ye, useMemo as Fe } from "react";
const at = [
  "I",
  "II",
  "III",
  "aVR",
  "aVL",
  "aVF",
  "V1",
  "V2",
  "V3",
  "V4",
  "V5",
  "V6"
], Oe = [25, 50], Be = [5, 10, 20], He = ["12x1", "6x2", "3x4"], $e = `
attribute vec2 a_pos;
attribute vec2 a_prev;
attribute vec2 a_next;
attribute float a_side;
uniform float u_timeOffsetSec;
uniform float u_pxPerSec;
uniform float u_pxPerMv;
uniform float u_originX;
uniform float u_baselineY;
uniform vec2 u_canvasSizePx;
uniform float u_thicknessPx;

vec2 toScreen(vec2 p) {
  return vec2(
    u_originX + (p.x - u_timeOffsetSec) * u_pxPerSec,
    u_baselineY - p.y * u_pxPerMv
  );
}

void main() {
  vec2 currS = toScreen(a_pos);
  vec2 prevS = toScreen(a_prev);
  vec2 nextS = toScreen(a_next);

  vec2 inDir = currS - prevS;
  vec2 outDir = nextS - currS;
  float inLen = length(inDir);
  float outLen = length(outDir);
  if (inLen > 0.0001) inDir /= inLen; else inDir = vec2(0.0);
  if (outLen > 0.0001) outDir /= outLen; else outDir = vec2(0.0);

  vec2 dir = inDir + outDir;
  float dl = length(dir);
  if (dl < 0.0001) {
    dir = outLen > 0.0001 ? outDir : inDir;
  } else {
    dir /= dl;
  }
  vec2 perp = vec2(-dir.y, dir.x);
  vec2 finalScreen = currS + perp * (u_thicknessPx * 0.5 * a_side);

  gl_Position = vec4(
    (finalScreen.x / u_canvasSizePx.x) * 2.0 - 1.0,
    1.0 - (finalScreen.y / u_canvasSizePx.y) * 2.0,
    0.0, 1.0
  );
}`, Ue = `
precision mediump float;
uniform vec3 u_color;
void main() {
  gl_FragColor = vec4(u_color, 1.0);
}`;
function Ce(s, e, t) {
  const r = s.createShader(e);
  if (!r) throw new Error("Failed to create shader.");
  if (s.shaderSource(r, t), s.compileShader(r), !s.getShaderParameter(r, s.COMPILE_STATUS)) {
    const n = s.getShaderInfoLog(r);
    throw s.deleteShader(r), new Error("Shader compilation failed: " + n);
  }
  return r;
}
function We(s, e, t) {
  const r = Ce(s, s.VERTEX_SHADER, e), n = Ce(s, s.FRAGMENT_SHADER, t), i = s.createProgram();
  if (!i) throw new Error("Failed to create program.");
  if (s.attachShader(i, r), s.attachShader(i, n), s.linkProgram(i), !s.getProgramParameter(i, s.LINK_STATUS)) {
    const a = s.getProgramInfoLog(i);
    throw s.deleteProgram(i), new Error("Program link failed: " + a);
  }
  return i;
}
function Ve(s) {
  const e = getComputedStyle(s), t = (n, i) => e.getPropertyValue(n).trim() || i, r = t("--ecg-trace-thickness", "1");
  return {
    background: t("--ecg-bg", "#ffffff"),
    gridMinor: t("--ecg-grid-minor", "#d6d6d6"),
    gridMajor: t("--ecg-grid-major", "#7a7a7a"),
    label: t("--ecg-label", "#000000"),
    accent: t("--ecg-accent", "#1f3a8a"),
    chipBg: t("--ecg-ui-chip-bg", "rgba(255,255,255,0.7)"),
    chipBorder: t("--ecg-ui-chip-border", "rgba(0,0,0,0.1)"),
    trace: Ne(t("--ecg-trace", "#000000")),
    traceThicknessPx: Math.max(0.5, parseFloat(r) || 1)
  };
}
function Ne(s) {
  const e = document.createElement("canvas").getContext("2d");
  if (!e) return [0, 0, 0];
  e.fillStyle = "#000", e.fillStyle = s;
  const t = e.fillStyle;
  if (t.startsWith("#") && t.length === 7)
    return [
      parseInt(t.slice(1, 3), 16) / 255,
      parseInt(t.slice(3, 5), 16) / 255,
      parseInt(t.slice(5, 7), 16) / 255
    ];
  const r = t.match(/^rgba?\(([^)]+)\)$/);
  if (r) {
    const n = r[1].split(",").map((i) => parseFloat(i.trim()));
    return [n[0] / 255, n[1] / 255, n[2] / 255];
  }
  return [0, 0, 0];
}
function Ge(s, e) {
  const t = document.createElement("canvas").getContext("2d");
  if (!t) return s;
  t.fillStyle = "#000", t.fillStyle = s;
  const r = t.fillStyle;
  if (r.startsWith("#") && r.length === 7) {
    const i = parseInt(r.slice(1, 3), 16), a = parseInt(r.slice(3, 5), 16), u = parseInt(r.slice(5, 7), 16);
    return `rgba(${i},${a},${u},${e})`;
  }
  const n = r.match(/^rgba?\(([^)]+)\)$/);
  if (n) {
    const i = n[1].split(",").map((a) => parseFloat(a.trim()));
    return `rgba(${i[0]},${i[1]},${i[2]},${e})`;
  }
  return s;
}
const ye = [
  "I",
  "II",
  "III",
  "aVR",
  "aVL",
  "aVF",
  "V1",
  "V2",
  "V3",
  "V4",
  "V5",
  "V6"
];
function qe(s) {
  switch (s) {
    case "12x1":
      return {
        rows: 12,
        cols: 1,
        leadIndex: [[0], [1], [2], [3], [4], [5], [6], [7], [8], [9], [10], [11]]
      };
    case "6x2":
      return {
        rows: 6,
        cols: 2,
        leadIndex: [
          [0, 6],
          [1, 7],
          [2, 8],
          [3, 9],
          [4, 10],
          [5, 11]
        ]
      };
    case "3x4":
      return {
        rows: 3,
        cols: 4,
        leadIndex: [
          [0, 3, 6, 9],
          [1, 4, 7, 10],
          [2, 5, 8, 11]
        ]
      };
  }
}
function ze(s) {
  switch (s) {
    case "12x1":
      return "12 × 1";
    case "6x2":
      return "6 × 2";
    case "3x4":
      return "3 × 4";
  }
}
const ve = 96 / 25.4, xe = 16384;
class je {
  constructor(e, t, r, n) {
    H(this, "gl");
    H(this, "overlayCtx");
    H(this, "program");
    H(this, "locs");
    /** Per-channel expanded vertex buffer (2N vertices × 7 floats). */
    H(this, "buffers", []);
    H(this, "record", null);
    H(this, "options");
    H(this, "lastInfo", null);
    H(this, "hits", []);
    H(this, "caliperHits", []);
    /** Stored each render() so screen↔canvas-mm conversion works post-render. */
    H(this, "lastPxPerMm", ve);
    /** Hard cap on canvas internal pixels along one axis (driver/GPU limit). */
    H(this, "maxInternalPx", xe);
    this.glCanvas = e, this.overlayCanvas = t, this.themeHost = r;
    const i = e.getContext("webgl", {
      antialias: !0,
      preserveDrawingBuffer: !0,
      alpha: !0,
      premultipliedAlpha: !1
    });
    if (!i) throw new Error("WebGL non disponible sur ce navigateur.");
    this.gl = i;
    const a = t.getContext("2d");
    if (!a) throw new Error("Canvas 2D non disponible.");
    this.overlayCtx = a, this.options = n, this.program = We(i, $e, Ue), i.useProgram(this.program), this.locs = {
      a_pos: i.getAttribLocation(this.program, "a_pos"),
      a_prev: i.getAttribLocation(this.program, "a_prev"),
      a_next: i.getAttribLocation(this.program, "a_next"),
      a_side: i.getAttribLocation(this.program, "a_side"),
      u_timeOffsetSec: i.getUniformLocation(this.program, "u_timeOffsetSec"),
      u_pxPerSec: i.getUniformLocation(this.program, "u_pxPerSec"),
      u_pxPerMv: i.getUniformLocation(this.program, "u_pxPerMv"),
      u_originX: i.getUniformLocation(this.program, "u_originX"),
      u_baselineY: i.getUniformLocation(this.program, "u_baselineY"),
      u_canvasSizePx: i.getUniformLocation(this.program, "u_canvasSizePx"),
      u_thicknessPx: i.getUniformLocation(this.program, "u_thicknessPx"),
      u_color: i.getUniformLocation(this.program, "u_color")
    };
    const u = i.getParameter(i.MAX_VIEWPORT_DIMS), c = i.getParameter(i.MAX_TEXTURE_SIZE);
    this.maxInternalPx = Math.max(
      1024,
      Math.min(
        u ? Math.min(u[0], u[1]) : xe,
        typeof c == "number" && c > 0 ? c : xe
      )
    );
  }
  setData(e) {
    const t = this.gl;
    for (const n of this.buffers) n && t.deleteBuffer(n.buf);
    this.buffers = [], this.record = e;
    const r = 1 / e.samplingFrequency;
    for (const n of e.channels) {
      const i = n.samples.length, a = new Float32Array(i * 2 * 7);
      for (let c = 0; c < i; c++) {
        const m = c * r, d = n.samples[c], g = c > 0 ? (c - 1) * r : m, y = c > 0 ? n.samples[c - 1] : d, C = c < i - 1 ? (c + 1) * r : m, w = c < i - 1 ? n.samples[c + 1] : d;
        for (let b = 0; b < 2; b++) {
          const f = (c * 2 + b) * 7;
          a[f + 0] = m, a[f + 1] = d, a[f + 2] = g, a[f + 3] = y, a[f + 4] = C, a[f + 5] = w, a[f + 6] = b === 0 ? 1 : -1;
        }
      }
      const u = t.createBuffer();
      t.bindBuffer(t.ARRAY_BUFFER, u), t.bufferData(t.ARRAY_BUFFER, a, t.STATIC_DRAW), this.buffers.push({ buf: u, n: i });
    }
  }
  setOptions(e) {
    this.options = e;
  }
  getLastInfo() {
    return this.lastInfo;
  }
  hitTest(e, t) {
    for (const r of this.hits)
      if (e >= r.x && e < r.x + r.w && t >= r.y && t < r.y + r.h)
        return r.hit;
    return null;
  }
  hitTestCaliperLabel(e, t) {
    for (let r = this.caliperHits.length - 1; r >= 0; r--) {
      const n = this.caliperHits[r];
      if (e >= n.x && e < n.x + n.w && t >= n.y && t < n.y + n.h)
        return n.id;
    }
    return null;
  }
  cssToCanvasMm(e, t) {
    return { x: e / this.lastPxPerMm, y: t / this.lastPxPerMm };
  }
  render(e, t, r = 1, n = {}) {
    if (!this.record) return null;
    const { layout: i, timeScale: a, amplitudeScale: u, rhythmLead: c } = this.options, m = qe(i), d = i === "6x2" || i === "3x4", g = Ve(this.themeHost), y = this.record.durationSec / m.cols, b = 7 * (10 * 2), f = 10, D = f + 3, ue = 5, q = 8, Q = 7, $ = d ? 5 : 0, N = d ? m.rows + 1 : m.rows, T = (b - $) / N, L = d ? T : 0, I = y * a, ee = m.cols * I, ae = m.rows * T + $ + L, K = D + ee + ue, he = q + ae + Q, z = K * ve, O = he * ve, U = Math.min(
      e / z,
      t / O
    ) * r, W = Math.max(1, z * U), X = Math.max(1, O * U), Z = window.devicePixelRatio || 1, te = this.maxInternalPx / W, _ = this.maxInternalPx / X, V = Math.max(1, Math.min(Z, te, _));
    _e(this.glCanvas, W, X, V), _e(this.overlayCanvas, W, X, V);
    const B = ve * U, oe = a * B, ce = u * B;
    this.lastPxPerMm = B;
    const G = d ? (q + m.rows * T + $ + L / 2) * B : null, me = D * B;
    this.drawOverlay({
      cssWidth: W,
      cssHeight: X,
      dpr: V,
      theme: g,
      grid: m,
      layout: i,
      leftMarginMm: D,
      topMarginMm: q,
      rowHeightMm: T,
      segWidthMm: I,
      labelWidthMm: f,
      pxPerMm: B,
      timeScale: a,
      amplitudeScale: u,
      hasRhythmStrip: d,
      rhythmLead: c,
      rhythmBaselineY: G,
      rhythmOriginX: me,
      rhythmRowMm: L,
      plotHeightMm: ae,
      calipers: n.calipers ?? [],
      previewCaliper: n.preview ?? null,
      hoveredCaliperId: n.hoveredCaliperId ?? null,
      crosshair: n.crosshair ?? null
    });
    const Y = this.gl;
    Y.viewport(0, 0, Y.drawingBufferWidth, Y.drawingBufferHeight), Y.clearColor(0, 0, 0, 0), Y.clear(Y.COLOR_BUFFER_BIT), Y.useProgram(this.program), Y.uniform2f(this.locs.u_canvasSizePx, W, X), Y.uniform1f(this.locs.u_pxPerSec, oe), Y.uniform1f(this.locs.u_pxPerMv, ce), Y.uniform1f(this.locs.u_thicknessPx, g.traceThicknessPx), Y.uniform3f(this.locs.u_color, g.trace[0], g.trace[1], g.trace[2]);
    for (let le = 0; le < m.rows; le++) {
      const fe = (q + (le + 0.5) * T) * B;
      for (let se = 0; se < m.cols; se++) {
        const ie = m.leadIndex[le][se];
        ie < 0 || this.drawTraceSegment({
          leadIdx: ie,
          startSec: se * y,
          durationSec: y,
          originX: (D + se * I) * B,
          baselineY: fe
        });
      }
    }
    return d && G !== null && c >= 0 && c < 12 && this.drawTraceSegment({
      leadIdx: c,
      startSec: 0,
      durationSec: this.record.durationSec,
      originX: me,
      baselineY: G
    }), this.lastInfo = {
      effectiveTimeScale: a * U,
      effectiveAmplitudeScale: u * U,
      fitScale: U,
      cssWidth: W,
      cssHeight: X
    }, this.lastInfo;
  }
  exportPng() {
    const e = document.createElement("canvas");
    e.width = this.glCanvas.width, e.height = this.glCanvas.height;
    const t = e.getContext("2d");
    return t.drawImage(this.overlayCanvas, 0, 0), t.drawImage(this.glCanvas, 0, 0), e.toDataURL("image/png");
  }
  dispose() {
    const e = this.gl;
    for (const t of this.buffers) t && e.deleteBuffer(t.buf);
    this.buffers = [], e.deleteProgram(this.program);
  }
  // ---------- Private ----------
  drawTraceSegment(e) {
    if (!this.record) return;
    const t = this.gl, r = this.buffers[e.leadIdx];
    if (!r) return;
    t.uniform1f(this.locs.u_originX, e.originX), t.uniform1f(this.locs.u_baselineY, e.baselineY), t.uniform1f(this.locs.u_timeOffsetSec, e.startSec), t.bindBuffer(t.ARRAY_BUFFER, r.buf);
    const n = 7 * 4;
    we(t, this.locs.a_pos, 2, n, 0), we(t, this.locs.a_prev, 2, n, 2 * 4), we(t, this.locs.a_next, 2, n, 4 * 4), we(t, this.locs.a_side, 1, n, 6 * 4);
    const i = this.record.samplingFrequency, a = Math.max(0, Math.floor(e.startSec * i)), u = Math.min(
      r.n,
      Math.ceil((e.startSec + e.durationSec) * i) + 1
    ), c = Math.max(0, u - a);
    c >= 2 && t.drawArrays(t.TRIANGLE_STRIP, a * 2, c * 2);
  }
  drawOverlay(e) {
    const t = this.overlayCtx, { cssWidth: r, cssHeight: n, dpr: i, theme: a, grid: u } = e;
    this.hits = [], this.caliperHits = [], t.setTransform(1, 0, 0, 1, 0, 0), t.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height), t.setTransform(i, 0, 0, i, 0, 0), t.fillStyle = a.background, t.fillRect(0, 0, r, n);
    const c = e.pxPerMm;
    this.drawGrid(t, r, n, c, a), this.drawColumnSeparators(t, e);
    const m = Math.max(10, Math.min(16, e.rowHeightMm * c * 0.22));
    this.drawLeadLabels(t, e, m), this.drawRhythmStripLabel(t, e, m), this.drawLayoutChip(t, e, m), this.drawScaleChips(t, e, m), e.crosshair && this.drawCrosshair(t, e.crosshair, e);
    for (const d of e.calipers)
      this.drawCaliper(
        t,
        d,
        c,
        r,
        n,
        a,
        e.timeScale,
        e.amplitudeScale,
        d.id === e.hoveredCaliperId,
        !1
      );
    e.previewCaliper && this.drawCaliper(
      t,
      e.previewCaliper,
      c,
      r,
      n,
      a,
      e.timeScale,
      e.amplitudeScale,
      !1,
      !0
    );
  }
  drawCrosshair(e, t, r) {
    const n = r.leftMarginMm, i = r.leftMarginMm + r.grid.cols * r.segWidthMm;
    if (t.x < n || t.x > i) return;
    const a = Math.round(t.x * r.pxPerMm) + 0.5, u = r.topMarginMm * r.pxPerMm, c = (r.topMarginMm + r.plotHeightMm) * r.pxPerMm;
    e.save(), e.strokeStyle = r.theme.accent, e.globalAlpha = 0.55, e.lineWidth = 1, e.setLineDash([4, 3]), e.beginPath(), e.moveTo(a, u), e.lineTo(a, c), e.stroke(), e.restore();
  }
  drawGrid(e, t, r, n, i) {
    const a = (u, c, m) => {
      e.strokeStyle = c, e.lineWidth = m, e.beginPath();
      const d = u * n;
      for (let g = 0; g <= t + 0.5; g += d) {
        const y = Math.round(g) + 0.5;
        e.moveTo(y, 0), e.lineTo(y, r);
      }
      for (let g = 0; g <= r + 0.5; g += d) {
        const y = Math.round(g) + 0.5;
        e.moveTo(0, y), e.lineTo(t, y);
      }
      e.stroke();
    };
    a(1, i.gridMinor, 0.5), a(5, i.gridMajor, 0.9);
  }
  drawColumnSeparators(e, t) {
    if (t.grid.cols <= 1) return;
    const r = t.pxPerMm, n = t.rowHeightMm / 4, i = n / 4, a = (n - i) / 2 * r, u = i / 2 * r;
    e.strokeStyle = t.theme.label, e.lineWidth = 1.2, e.beginPath();
    for (let c = 1; c < t.grid.cols; c++) {
      const m = t.leftMarginMm + c * t.segWidthMm, d = Math.round(m * r) + 0.5;
      for (let g = 0; g < t.grid.rows; g++) {
        const y = (t.topMarginMm + (g + 0.5) * t.rowHeightMm) * r;
        e.moveTo(d, y - u - a), e.lineTo(d, y - u), e.moveTo(d, y + u), e.lineTo(d, y + u + a);
      }
    }
    e.stroke();
  }
  drawLeadLabels(e, t, r) {
    e.font = `600 ${r}px system-ui, sans-serif`, e.textBaseline = "middle";
    for (let n = 0; n < t.grid.rows; n++) {
      const i = (t.topMarginMm + (n + 0.5) * t.rowHeightMm) * t.pxPerMm;
      for (let a = 0; a < t.grid.cols; a++) {
        const u = t.grid.leadIndex[n][a];
        if (u < 0) continue;
        const m = (t.leftMarginMm + a * t.segWidthMm) * t.pxPerMm - t.labelWidthMm * t.pxPerMm, d = i - t.rowHeightMm * t.pxPerMm * 0.35, g = t.hasRhythmStrip && u === t.rhythmLead;
        this.drawLeadLabelText(e, ye[u], m, d, r, {
          color: g ? t.theme.accent : t.theme.label,
          underline: g
        });
        const y = e.measureText(ye[u]), C = 4, w = 6;
        this.hits.push({
          x: m - C,
          y: d - r / 2 - w,
          w: Math.max(y.width, t.labelWidthMm * t.pxPerMm) + 2 * C,
          h: r + 2 * w,
          hit: { kind: "lead", leadIndex: u }
        });
      }
    }
  }
  drawRhythmStripLabel(e, t, r) {
    if (!t.hasRhythmStrip || t.rhythmBaselineY === null || t.rhythmLead < 0 || t.rhythmLead >= 12) return;
    const n = t.rhythmBaselineY, i = t.rhythmOriginX - t.labelWidthMm * t.pxPerMm, a = n - t.rhythmRowMm * t.pxPerMm * 0.35;
    this.drawLeadLabelText(e, ye[t.rhythmLead], i, a, r, {
      color: t.theme.accent,
      underline: !1,
      bold: !0,
      prefix: "▸ "
    });
    const u = e.measureText(`▸ ${ye[t.rhythmLead]}`), c = 4, m = 6;
    this.hits.push({
      x: i - c,
      y: a - r / 2 - m,
      w: Math.max(u.width, t.labelWidthMm * t.pxPerMm) + 2 * c,
      h: r + 2 * m,
      hit: { kind: "lead", leadIndex: t.rhythmLead }
    });
  }
  drawLayoutChip(e, t, r) {
    const n = ze(t.layout), i = this.drawChip(e, {
      text: n,
      x: 6,
      y: 6,
      fontPx: Math.max(10, r * 0.85),
      textColor: t.theme.label,
      bg: t.theme.chipBg,
      border: t.theme.chipBorder
    });
    this.hits.push({ ...i, hit: { kind: "cycleLayout" } });
  }
  drawScaleChips(e, t, r) {
    const n = Math.max(10, r * 0.85), i = `${t.amplitudeScale} mm/mV`, a = `${t.timeScale} mm/s`;
    e.font = `600 ${n}px system-ui, sans-serif`;
    const u = e.measureText(i).width + 16, c = e.measureText(a).width + 16, m = n + 10, d = 6, g = 6, y = t.cssWidth - d - u, C = t.cssHeight - d - m, w = this.drawChip(e, {
      text: i,
      x: y,
      y: C,
      fontPx: n,
      textColor: t.theme.label,
      bg: t.theme.chipBg,
      border: t.theme.chipBorder,
      widthOverride: u
    });
    this.hits.push({ ...w, hit: { kind: "cycleAmp" } });
    const b = y - g - c, f = this.drawChip(e, {
      text: a,
      x: b,
      y: C,
      fontPx: n,
      textColor: t.theme.label,
      bg: t.theme.chipBg,
      border: t.theme.chipBorder,
      widthOverride: c
    });
    this.hits.push({ ...f, hit: { kind: "cycleTime" } });
  }
  drawCaliper(e, t, r, n, i, a, u, c, m, d) {
    const g = t.startXmm * r, y = t.startYmm * r, C = t.endXmm * r, w = t.endYmm * r;
    e.save(), d && (e.globalAlpha = 0.7), e.strokeStyle = a.accent, e.lineWidth = 1.5, e.beginPath();
    let b, f;
    if (t.mode === "time") {
      const I = (y + w) / 2;
      e.moveTo(g, 0), e.lineTo(g, i), e.moveTo(C, 0), e.lineTo(C, i), e.moveTo(g, I), e.lineTo(C, I), e.stroke(), b = `${(Math.abs(t.endXmm - t.startXmm) / u * 1e3).toFixed(0)} ms`, f = { x: (g + C) / 2, y: I, side: "top" };
    } else {
      const I = (g + C) / 2;
      e.moveTo(0, y), e.lineTo(n, y), e.moveTo(0, w), e.lineTo(n, w), e.moveTo(I, y), e.lineTo(I, w), e.stroke(), b = `${(Math.abs(t.endYmm - t.startYmm) / c).toFixed(2)} mV`, f = { x: I, y: (y + w) / 2, side: "right" };
    }
    const D = 12;
    e.font = `600 ${D}px system-ui, sans-serif`;
    const ue = e.measureText(b).width, q = 6, Q = 4, $ = ue + 2 * q, N = D + 2 * Q;
    let T, L;
    f.side === "top" ? (T = f.x - $ / 2, L = f.y - N - 2) : (T = f.x + 4, L = f.y - N / 2), e.fillStyle = m ? Ge(a.accent, 0.18) : a.chipBg, e.strokeStyle = m ? a.accent : a.chipBorder, e.lineWidth = m ? 1.2 : 1, Le(e, T + 0.5, L + 0.5, $ - 1, N - 1, 3), e.fill(), e.stroke(), e.fillStyle = a.accent, e.textAlign = "center", e.textBaseline = "middle", e.fillText(b, T + $ / 2, L + N / 2), e.restore(), d || this.caliperHits.push({ x: T, y: L, w: $, h: N, id: t.id });
  }
  drawLeadLabelText(e, t, r, n, i, a) {
    e.fillStyle = a.color, e.font = `${a.bold ? 700 : 600} ${i}px system-ui, sans-serif`, e.textAlign = "left", e.textBaseline = "middle";
    const u = (a.prefix ?? "") + t;
    if (e.fillText(u, r, n), a.underline) {
      const c = e.measureText(u);
      e.strokeStyle = a.color, e.lineWidth = 1, e.beginPath(), e.moveTo(r, n + i / 2 + 1), e.lineTo(r + c.width, n + i / 2 + 1), e.stroke();
    }
  }
  drawChip(e, t) {
    e.font = `600 ${t.fontPx}px system-ui, sans-serif`;
    const r = 8, n = 5, i = e.measureText(t.text).width, a = t.widthOverride ?? i + 2 * r, u = t.fontPx + 2 * n, c = 4;
    return e.fillStyle = t.bg, e.strokeStyle = t.border, e.lineWidth = 1, Le(e, t.x + 0.5, t.y + 0.5, a - 1, u - 1, c), e.fill(), e.stroke(), e.fillStyle = t.textColor, e.textAlign = "center", e.textBaseline = "middle", e.fillText(t.text, t.x + a / 2, t.y + u / 2), { x: t.x, y: t.y, w: a, h: u };
  }
}
function we(s, e, t, r, n) {
  e < 0 || (s.enableVertexAttribArray(e), s.vertexAttribPointer(e, t, s.FLOAT, !1, r, n));
}
function Le(s, e, t, r, n, i) {
  const a = Math.min(i, r / 2, n / 2);
  s.beginPath(), s.moveTo(e + a, t), s.arcTo(e + r, t, e + r, t + n, a), s.arcTo(e + r, t + n, e, t + n, a), s.arcTo(e, t + n, e, t, a), s.arcTo(e, t, e + r, t, a), s.closePath();
}
function _e(s, e, t, r) {
  s.style.width = e + "px", s.style.height = t + "px";
  const n = Math.round(e * r), i = Math.round(t * r);
  s.width !== n && (s.width = n), s.height !== i && (s.height = i);
}
const Ke = {
  layout: "3x4",
  timeScale: 25,
  amplitudeScale: 10,
  rhythmLead: 1
  // II
}, Ze = 1, Je = 5, Qe = 5, be = 50;
function Pe(s, e) {
  const t = s.indexOf(e);
  return s[(t + 1) % s.length];
}
function et(s) {
  return s.ctrlKey || s.metaKey;
}
function Te(s, e, t, r, n) {
  const i = e <= r ? (r - e) / 2 : Math.max(r - e, Math.min(0, s.x)), a = t <= n ? (n - t) / 2 : Math.max(n - t, Math.min(0, s.y));
  return { x: i, y: a };
}
const Ee = {
  kind: "idle",
  startCss: { x: 0, y: 0 },
  startMm: { x: 0, y: 0 }
}, ot = Xe(function({ record: e, initialOptions: t, className: r, onOptionsChange: n }, i) {
  const [a, u] = ne({
    ...Ke,
    ...t
  }), c = k(a);
  R(() => {
    c.current = a;
  }, [a]), R(() => {
    n == null || n(a);
  }, [a, n]);
  const m = k(null), d = k(null), g = k(null), y = k(null), C = k(null), w = k(null), b = k(1), f = k({ x: 0, y: 0 }), [D, ue] = ne(null), [q, Q] = ne(1), [$, N] = ne(null), [T, L] = ne([]), [I, ee] = ne(null), [ae, K] = ne(null), [he, z] = ne(null), O = k([]), de = k(null), U = k(null), W = k(null), X = k(Ee), Z = k({ past: [], future: [] });
  R(() => {
    O.current = T;
  }, [T]), R(() => {
    de.current = I;
  }, [I]), R(() => {
    U.current = ae;
  }, [ae]), R(() => {
    W.current = he;
  }, [he]);
  const te = F(() => {
    g.current && (g.current.style.transform = `translate(${f.current.x}px, ${f.current.y}px)`);
  }, []);
  R(() => {
    if (!(!y.current || !C.current || !m.current)) {
      try {
        w.current = new je(
          y.current,
          C.current,
          m.current,
          a
        );
      } catch (o) {
        N(o instanceof Error ? o.message : String(o));
        return;
      }
      return () => {
        var o;
        (o = w.current) == null || o.dispose(), w.current = null;
      };
    }
  }, []), R(() => {
    if (!(!w.current || !e))
      try {
        w.current.setData(e), N(null);
      } catch (o) {
        N(o instanceof Error ? o.message : String(o));
      }
  }, [e]);
  const _ = F(() => {
    const o = w.current, l = d.current;
    if (!o || !l || !e) return;
    const h = l.clientWidth, v = l.clientHeight;
    if (h <= 0 || v <= 0) return;
    const p = o.render(h, v, b.current, {
      calipers: O.current,
      preview: de.current,
      hoveredCaliperId: U.current,
      crosshair: W.current
    });
    p && (ue(p), f.current = Te(
      f.current,
      p.cssWidth,
      p.cssHeight,
      h,
      v
    ), te());
  }, [e, te]);
  R(() => {
    _();
  }, [T, I, ae, he, _]), R(() => {
    b.current = 1, f.current = { x: 0, y: 0 }, Q(1), L([]), ee(null), K(null), z(null), Z.current = { past: [], future: [] }, _();
  }, [e, _]), R(() => {
    w.current && (b.current = 1, f.current = { x: 0, y: 0 }, Q(1), w.current.setOptions(a), _());
  }, [a, _]), R(() => {
    const o = d.current;
    if (!o) return;
    const l = new ResizeObserver(() => _());
    return l.observe(o), () => l.disconnect();
  }, [_]);
  const V = F((o) => {
    const l = Z.current;
    Z.current = {
      past: [...l.past, o].slice(-be),
      future: []
    };
  }, []), B = F(() => {
    const o = Z.current;
    if (o.past.length === 0) return;
    const l = o.past[o.past.length - 1];
    Z.current = {
      past: o.past.slice(0, -1),
      future: [O.current, ...o.future].slice(0, be)
    }, L(l), K(null);
  }, []), oe = F(() => {
    const o = Z.current;
    if (o.future.length === 0) return;
    const l = o.future[0];
    Z.current = {
      past: [...o.past, O.current].slice(-be),
      future: o.future.slice(1)
    }, L(l), K(null);
  }, []), ce = F(() => {
    var l, h;
    const o = m.current;
    o && (document.fullscreenElement ? (l = document.exitFullscreen) == null || l.call(document).catch(() => {
    }) : (h = o.requestFullscreen) == null || h.call(o).catch(() => {
    }));
  }, []);
  R(() => {
    const o = d.current;
    if (!o) return;
    const l = (h) => {
      var M;
      h.preventDefault();
      const v = o.getBoundingClientRect(), p = h.clientX - v.left, P = h.clientY - v.top;
      if (et(h)) {
        const A = Math.exp(-h.deltaY * 15e-4), x = b.current, S = Math.max(Ze, Math.min(Je, x * A));
        if (S === x) return;
        const E = S / x;
        f.current = {
          x: p * (1 - E) + f.current.x * E,
          y: P * (1 - E) + f.current.y * E
        }, b.current = S, Q(S), _();
      } else if (b.current > 1) {
        const A = (M = w.current) == null ? void 0 : M.getLastInfo();
        if (!A) return;
        f.current = Te(
          { x: f.current.x - h.deltaX, y: f.current.y - h.deltaY },
          A.cssWidth,
          A.cssHeight,
          v.width,
          v.height
        ), te();
      }
    };
    return o.addEventListener("wheel", l, { passive: !1 }), () => o.removeEventListener("wheel", l);
  }, [_, te]), R(() => {
    const o = d.current;
    if (!o) return;
    let l = !1, h = 0, v = 0, p = 0, P = 0;
    const M = (S) => {
      S.button === 1 && (b.current <= 1 || (S.preventDefault(), l = !0, h = S.clientX, v = S.clientY, p = f.current.x, P = f.current.y, o.setPointerCapture(S.pointerId)));
    }, A = (S) => {
      var pe;
      if (!l) return;
      const E = (pe = w.current) == null ? void 0 : pe.getLastInfo();
      if (!E) return;
      const j = o.getBoundingClientRect();
      f.current = Te(
        { x: p + (S.clientX - h), y: P + (S.clientY - v) },
        E.cssWidth,
        E.cssHeight,
        j.width,
        j.height
      ), te();
    }, x = (S) => {
      if (l) {
        l = !1;
        try {
          o.releasePointerCapture(S.pointerId);
        } catch {
        }
      }
    };
    return o.addEventListener("pointerdown", M), o.addEventListener("pointermove", A), o.addEventListener("pointerup", x), o.addEventListener("pointercancel", x), () => {
      o.removeEventListener("pointerdown", M), o.removeEventListener("pointermove", A), o.removeEventListener("pointerup", x), o.removeEventListener("pointercancel", x);
    };
  }, [te]), R(() => {
    const o = d.current;
    if (!o) return;
    const l = (h) => {
      h.button === 1 && h.preventDefault();
    };
    return o.addEventListener("auxclick", l), () => o.removeEventListener("auxclick", l);
  }, []), R(() => {
    const o = (l) => {
      if (l.target instanceof HTMLInputElement || l.target instanceof HTMLSelectElement || l.target instanceof HTMLTextAreaElement || X.current.kind !== "idle") return;
      const h = l.ctrlKey || l.metaKey, v = l.key.toLowerCase();
      if (h && !l.shiftKey && v === "z") {
        l.preventDefault(), B();
        return;
      }
      if (h && l.shiftKey && v === "z" || h && v === "y") {
        l.preventDefault(), oe();
        return;
      }
      if (!h && v === "f") {
        l.preventDefault(), ce();
        return;
      }
      const p = U.current;
      p && !h && (l.key === "Delete" || l.key === "Backspace" || v === "d") && (l.preventDefault(), V(O.current), L((P) => P.filter((M) => M.id !== p)), K(null));
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
  }, [B, oe, ce, V]);
  const G = F(
    (o, l) => {
      u((h) => ({ ...h, [o]: l }));
    },
    []
  ), me = F(
    (o, l) => {
      const h = w.current;
      if (!h) return;
      const v = h.hitTest(o, l);
      if (!v) return;
      const p = c.current;
      switch (v.kind) {
        case "lead":
          (p.layout === "6x2" || p.layout === "3x4") && v.leadIndex !== p.rhythmLead && G("rhythmLead", v.leadIndex);
          break;
        case "cycleTime":
          G("timeScale", Pe(Oe, p.timeScale));
          break;
        case "cycleAmp":
          G("amplitudeScale", Pe(Be, p.amplitudeScale));
          break;
        case "cycleLayout":
          G("layout", Pe(He, p.layout));
          break;
      }
    },
    [G]
  ), Y = F((o) => {
    if (o.button !== 0) return;
    const l = w.current;
    if (!l) return;
    const h = o.currentTarget, v = h.getBoundingClientRect(), p = o.clientX - v.left, P = o.clientY - v.top, M = l.cssToCanvasMm(p, P), A = l.hitTestCaliperLabel(p, P);
    if (A) {
      const x = O.current.find((S) => S.id === A);
      if (x) {
        X.current = {
          kind: "moving",
          startCss: { x: p, y: P },
          startMm: M,
          initialCaliper: x,
          historyPushed: !1
        }, h.setPointerCapture(o.pointerId), h.style.cursor = "grabbing", z(null);
        return;
      }
    }
    X.current = { kind: "pending", startCss: { x: p, y: P }, startMm: M }, h.setPointerCapture(o.pointerId);
  }, []), le = F((o) => {
    const l = w.current;
    if (!l) return;
    const h = o.currentTarget, v = h.getBoundingClientRect(), p = o.clientX - v.left, P = o.clientY - v.top, M = X.current;
    if (M.kind === "pending") {
      const x = p - M.startCss.x, S = P - M.startCss.y;
      if (Math.hypot(x, S) < Qe) return;
      M.kind = "creating", h.style.cursor = "crosshair", z(null);
    }
    if (M.kind === "creating") {
      const x = l.cssToCanvasMm(p, P), S = p - M.startCss.x, E = P - M.startCss.y, j = Math.abs(E) > Math.abs(S) ? "amp" : "time";
      ee({
        id: "__preview",
        mode: j,
        startXmm: M.startMm.x,
        startYmm: M.startMm.y,
        endXmm: x.x,
        endYmm: x.y
      });
      return;
    }
    if (M.kind === "moving" && M.initialCaliper) {
      M.historyPushed || (V(O.current), M.historyPushed = !0);
      const x = l.cssToCanvasMm(p, P), S = x.x - M.startMm.x, E = x.y - M.startMm.y, j = M.initialCaliper;
      L(
        (pe) => pe.map(
          (Se) => Se.id === j.id ? {
            ...Se,
            startXmm: j.startXmm + S,
            startYmm: j.startYmm + E,
            endXmm: j.endXmm + S,
            endYmm: j.endYmm + E
          } : Se
        )
      );
      return;
    }
    const A = l.hitTestCaliperLabel(p, P);
    if (A !== U.current && K(A), A)
      h.style.cursor = "grab", W.current !== null && z(null);
    else {
      const x = l.hitTest(p, P), S = (x == null ? void 0 : x.kind) === "lead" && c.current.layout === "12x1";
      if (x && !S)
        h.style.cursor = "pointer", W.current !== null && z(null);
      else {
        h.style.cursor = "crosshair";
        const E = l.cssToCanvasMm(p, P);
        z({ x: E.x, y: E.y });
      }
    }
  }, [V]), fe = F((o) => {
    if (o.button !== 0) return;
    const l = o.currentTarget, h = X.current;
    if (h.kind === "pending")
      me(h.startCss.x, h.startCss.y);
    else if (h.kind === "creating") {
      const v = de.current;
      if (v) {
        V(O.current);
        const p = `cal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        L((P) => [...P, { ...v, id: p }]);
      }
      ee(null);
    }
    X.current = Ee;
    try {
      l.releasePointerCapture(o.pointerId);
    } catch {
    }
  }, [me, V]), se = F(() => {
    X.current.kind === "idle" && (U.current !== null && K(null), W.current !== null && z(null));
  }, []), ie = F(() => {
    b.current = 1, f.current = { x: 0, y: 0 }, Q(1), _();
  }, [_]), ge = F(() => {
    O.current.length !== 0 && (V(O.current), L([]), ee(null), K(null));
  }, [V]);
  Ye(i, () => ({
    exportPng: () => {
      var o;
      return ((o = w.current) == null ? void 0 : o.exportPng()) ?? null;
    },
    clearCalipers: ge,
    undo: B,
    redo: oe,
    resetZoom: ie,
    toggleFullscreen: ce,
    setOption: (o, l) => G(o, l),
    getOptions: () => c.current,
    refresh: () => _()
  }), [ge, B, oe, ie, ce, G, _]);
  const Ae = Fe(() => e ? /* @__PURE__ */ J("div", { className: "ecg-meta", children: [
    e.patientName && /* @__PURE__ */ re("span", { children: e.patientName }),
    /* @__PURE__ */ J("span", { children: [
      e.durationSec.toFixed(1),
      " s"
    ] }),
    /* @__PURE__ */ J("span", { children: [
      e.samplingFrequency,
      " Hz"
    ] }),
    D && Math.abs(D.fitScale - 1) > 0.01 && /* @__PURE__ */ J("span", { title: D.fitScale < 1 ? "L'ECG a été réduit pour tenir dans la fenêtre." : "L'ECG a été agrandi pour remplir la fenêtre.", children: [
      "échelle écran: ",
      D.effectiveTimeScale.toFixed(1),
      " mm/s ·",
      " ",
      D.effectiveAmplitudeScale.toFixed(1),
      " mm/mV"
    ] }),
    q > 1.001 && /* @__PURE__ */ J("span", { children: [
      "zoom × ",
      q.toFixed(2),
      " ",
      /* @__PURE__ */ re("button", { onClick: ie, children: "réinitialiser" })
    ] }),
    T.length > 0 && /* @__PURE__ */ J("span", { children: [
      T.length,
      " mesure",
      T.length > 1 ? "s" : "",
      " ",
      /* @__PURE__ */ re("button", { onClick: ge, children: "effacer" })
    ] })
  ] }) : null, [e, D, q, T.length, ie, ge]);
  return /* @__PURE__ */ J("div", { ref: m, className: `ecg-viewer${r ? ` ${r}` : ""}`, children: [
    Ae,
    /* @__PURE__ */ re("div", { className: "ecg-canvas-frame", children: /* @__PURE__ */ J("div", { className: "ecg-canvas-stage", ref: d, children: [
      $ && /* @__PURE__ */ re("div", { className: "ecg-error", children: $ }),
      !e && !$ && /* @__PURE__ */ re("div", { className: "ecg-empty", children: "Aucun ECG chargé." }),
      /* @__PURE__ */ J("div", { className: "ecg-canvas-wrap", ref: g, children: [
        /* @__PURE__ */ re(
          "canvas",
          {
            ref: C,
            className: "ecg-canvas ecg-canvas-overlay",
            onPointerDown: Y,
            onPointerMove: le,
            onPointerUp: fe,
            onPointerCancel: fe,
            onPointerLeave: se
          }
        ),
        /* @__PURE__ */ re("canvas", { ref: y, className: "ecg-canvas ecg-canvas-gl" })
      ] })
    ] }) })
  ] });
}), tt = new TextDecoder("utf-8"), rt = new TextEncoder();
function ct(s) {
  var u;
  const e = {
    numChannels: s.channels.length,
    numSamples: ((u = s.channels[0]) == null ? void 0 : u.samples.length) ?? 0,
    samplingFrequency: s.samplingFrequency,
    durationSec: s.durationSec,
    patientName: s.patientName,
    acquisitionDate: s.acquisitionDate,
    rawLeadOrder: s.rawLeadOrder,
    channelLabels: s.channels.map((c) => c.label)
  };
  let t = rt.encode(JSON.stringify(e));
  const r = (4 - t.length % 4) % 4;
  if (r > 0) {
    const c = new Uint8Array(t.length + r);
    c.set(t), c.fill(32, t.length), t = c;
  }
  const n = s.channels.reduce(
    (c, m) => c + m.samples.byteLength,
    0
  ), i = new Uint8Array(4 + t.length + n);
  new DataView(i.buffer).setUint32(0, t.length, !0), i.set(t, 4);
  let a = 4 + t.length;
  for (const c of s.channels)
    i.set(
      new Uint8Array(c.samples.buffer, c.samples.byteOffset, c.samples.byteLength),
      a
    ), a += c.samples.byteLength;
  return i;
}
function Re(s) {
  const e = s instanceof Uint8Array ? s : new Uint8Array(s);
  if (e.byteLength < 4) throw new Error("Wire payload too short.");
  const r = new DataView(e.buffer, e.byteOffset, e.byteLength).getUint32(0, !0);
  if (r % 4 !== 0 || 4 + r > e.byteLength)
    throw new Error("Invalid wire header.");
  const n = JSON.parse(
    tt.decode(e.subarray(4, 4 + r))
  ), i = e.byteOffset + 4 + r, a = n.numChannels * n.numSamples * 4, u = e.byteOffset + e.byteLength;
  if (i + a > u)
    throw new Error("Wire payload truncated.");
  return {
    channels: n.channelLabels.map((m, d) => ({
      label: m,
      samples: new Float32Array(
        e.buffer,
        i + d * n.numSamples * 4,
        n.numSamples
      )
    })),
    samplingFrequency: n.samplingFrequency,
    durationSec: n.durationSec,
    patientName: n.patientName,
    acquisitionDate: n.acquisitionDate,
    rawLeadOrder: n.rawLeadOrder
  };
}
function lt(s, e) {
  var n;
  const t = Math.floor(s.samplingFrequency * e);
  return (((n = s.channels[0]) == null ? void 0 : n.samples.length) ?? 0) <= t ? s : {
    ...s,
    channels: s.channels.map((i) => ({
      label: i.label,
      samples: i.samples.subarray(0, t)
    })),
    durationSec: t / s.samplingFrequency
  };
}
let Me = "";
function ut(s) {
  s.baseUrl !== void 0 && (Me = s.baseUrl.replace(/\/$/, ""));
}
async function ht() {
  const s = await fetch(`${Me}/api/samples`);
  if (!s.ok) throw new Error(`HTTP ${s.status} on /api/samples`);
  return s.json();
}
async function mt(s) {
  const e = await fetch(`${Me}/api/samples/${encodeURIComponent(s)}`);
  if (!e.ok) throw new Error(`Échantillon ${s} : ${await Ie(e)}`);
  return Re(await e.arrayBuffer());
}
async function dt(s) {
  const e = new FormData();
  e.append("file", s);
  const t = await fetch(`${Me}/api/parse`, { method: "POST", body: e });
  if (!t.ok) throw new Error(await Ie(t));
  return Re(await t.arrayBuffer());
}
async function Ie(s) {
  try {
    return (await s.json()).error ?? `HTTP ${s.status}`;
  } catch {
    return `HTTP ${s.status}`;
  }
}
export {
  Be as AMP_SCALES,
  ot as ECGViewer,
  He as LAYOUTS,
  at as STANDARD_LEADS_12,
  Oe as TIME_SCALES,
  ut as configureApi,
  Re as decodeRecord,
  ct as encodeRecord,
  ht as listSamples,
  mt as loadSample,
  lt as truncateRecord,
  dt as uploadDicom
};
