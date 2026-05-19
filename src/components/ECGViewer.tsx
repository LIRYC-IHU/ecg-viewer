import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  Caliper,
  EcgRecord,
  ViewerOptions,
} from '../types';
import { AMP_SCALES, LAYOUTS, TIME_SCALES } from '../types';
import { EcgRenderer, type RenderInfo } from '../webgl/EcgRenderer';
import './ECGViewer.css';

export interface ECGViewerProps {
  /** Parsed ECG record. Pass `null` to show the empty state. */
  record: EcgRecord | null;
  /** Initial layout / scale / rhythm choices. Defaults shown below. */
  initialOptions?: Partial<ViewerOptions>;
  /** Optional CSS class on the root element (e.g. for theming). */
  className?: string;
  /** Notified whenever the user changes layout / scale / rhythm via the UI. */
  onOptionsChange?: (options: ViewerOptions) => void;
}

export interface ECGViewerHandle {
  /** Return the current view as a PNG data URL (overlay + traces composited). */
  exportPng(): string | null;
  /** Remove all caliper measurements. */
  clearCalipers(): void;
  /** Reset zoom (1×) and pan. */
  resetZoom(): void;
  /** Programmatically update a single option. */
  setOption<K extends keyof ViewerOptions>(key: K, value: ViewerOptions[K]): void;
  /** Read the live options snapshot. */
  getOptions(): ViewerOptions;
  /** Re-read CSS theme variables and redraw (call after live CSS changes). */
  refresh(): void;
}

const DEFAULT_OPTIONS: ViewerOptions = {
  layout: '3x4',
  timeScale: 25,
  amplitudeScale: 10,
  rhythmLead: 1, // II
};

const ZOOM_MIN = 1;
const ZOOM_MAX = 5;
/** Pixels of pointer travel before a press becomes a drag (vs. a click). */
const DRAG_THRESHOLD_PX = 5;

function cycle<T>(arr: readonly T[], current: T): T {
  const i = arr.indexOf(current);
  return arr[(i + 1) % arr.length];
}

/** Only zoom on ctrl/cmd (matches macOS trackpad pinch + standard convention). */
function shouldZoom(e: WheelEvent): boolean {
  return e.ctrlKey || e.metaKey;
}

function clampPan(
  pan: { x: number; y: number },
  canvasW: number,
  canvasH: number,
  stageW: number,
  stageH: number,
): { x: number; y: number } {
  const x = canvasW <= stageW
    ? (stageW - canvasW) / 2
    : Math.max(stageW - canvasW, Math.min(0, pan.x));
  const y = canvasH <= stageH
    ? (stageH - canvasH) / 2
    : Math.max(stageH - canvasH, Math.min(0, pan.y));
  return { x, y };
}

interface DragState {
  kind: 'idle' | 'pending' | 'creating' | 'moving';
  startCss: { x: number; y: number };
  startMm: { x: number; y: number };
  initialCaliper?: Caliper;
}

const IDLE_DRAG: DragState = {
  kind: 'idle',
  startCss: { x: 0, y: 0 },
  startMm: { x: 0, y: 0 },
};

export const ECGViewer = forwardRef<ECGViewerHandle, ECGViewerProps>(function ECGViewer(
  { record, initialOptions, className, onOptionsChange },
  ref,
) {
  const [options, setOptions] = useState<ViewerOptions>({
    ...DEFAULT_OPTIONS,
    ...initialOptions,
  });
  const optionsRef = useRef(options);
  useEffect(() => { optionsRef.current = options; }, [options]);
  useEffect(() => { onOptionsChange?.(options); }, [options, onOptionsChange]);

  const viewerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<EcgRenderer | null>(null);

  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const [info, setInfo] = useState<RenderInfo | null>(null);
  const [zoomDisplay, setZoomDisplay] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Caliper state — refs mirror the latest values for use inside event handlers.
  const [calipers, setCalipers] = useState<Caliper[]>([]);
  const [previewCaliper, setPreviewCaliper] = useState<Caliper | null>(null);
  const [hoveredCaliperId, setHoveredCaliperId] = useState<string | null>(null);
  const calipersRef = useRef<Caliper[]>([]);
  const previewCaliperRef = useRef<Caliper | null>(null);
  const hoveredCaliperIdRef = useRef<string | null>(null);
  const dragRef = useRef<DragState>(IDLE_DRAG);
  useEffect(() => { calipersRef.current = calipers; }, [calipers]);
  useEffect(() => { previewCaliperRef.current = previewCaliper; }, [previewCaliper]);
  useEffect(() => { hoveredCaliperIdRef.current = hoveredCaliperId; }, [hoveredCaliperId]);

  const applyTransform = useCallback(() => {
    if (!wrapRef.current) return;
    wrapRef.current.style.transform =
      `translate(${panRef.current.x}px, ${panRef.current.y}px)`;
  }, []);

  // ---------- Renderer lifecycle ----------
  useEffect(() => {
    if (!glCanvasRef.current || !overlayCanvasRef.current || !viewerRef.current) return;
    try {
      rendererRef.current = new EcgRenderer(
        glCanvasRef.current,
        overlayCanvasRef.current,
        viewerRef.current,
        options,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!rendererRef.current || !record) return;
    try {
      rendererRef.current.setData(record);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [record]);

  const triggerRender = useCallback(() => {
    const renderer = rendererRef.current;
    const stage = stageRef.current;
    if (!renderer || !stage || !record) return;
    const stageW = stage.clientWidth;
    const stageH = stage.clientHeight;
    if (stageW <= 0 || stageH <= 0) return;
    const result = renderer.render(stageW, stageH, zoomRef.current, {
      calipers: calipersRef.current,
      preview: previewCaliperRef.current,
      hoveredCaliperId: hoveredCaliperIdRef.current,
    });
    if (!result) return;
    setInfo(result);
    panRef.current = clampPan(
      panRef.current, result.cssWidth, result.cssHeight, stageW, stageH,
    );
    applyTransform();
  }, [record, applyTransform]);

  // Re-render on caliper-state change.
  useEffect(() => {
    triggerRender();
  }, [calipers, previewCaliper, hoveredCaliperId, triggerRender]);

  // Reset transient state on data change.
  useEffect(() => {
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    setZoomDisplay(1);
    setCalipers([]);
    setPreviewCaliper(null);
    setHoveredCaliperId(null);
    triggerRender();
  }, [record, triggerRender]);

  // Reset zoom on layout / scale changes (preserving calipers).
  useEffect(() => {
    if (!rendererRef.current) return;
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    setZoomDisplay(1);
    rendererRef.current.setOptions(options);
    triggerRender();
  }, [options, triggerRender]);

  // ResizeObserver on the stage.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => triggerRender());
    ro.observe(el);
    return () => ro.disconnect();
  }, [triggerRender]);

  // ---------- Wheel: zoom (ctrl/cmd) or pan ----------
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      if (shouldZoom(e)) {
        const factor = Math.exp(-e.deltaY * 0.0015);
        const oldZoom = zoomRef.current;
        const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, oldZoom * factor));
        if (newZoom === oldZoom) return;
        const f = newZoom / oldZoom;
        panRef.current = {
          x: mx * (1 - f) + panRef.current.x * f,
          y: my * (1 - f) + panRef.current.y * f,
        };
        zoomRef.current = newZoom;
        setZoomDisplay(newZoom);
        triggerRender();
      } else if (zoomRef.current > 1) {
        const last = rendererRef.current?.getLastInfo();
        if (!last) return;
        panRef.current = clampPan(
          { x: panRef.current.x - e.deltaX, y: panRef.current.y - e.deltaY },
          last.cssWidth, last.cssHeight, rect.width, rect.height,
        );
        applyTransform();
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [triggerRender, applyTransform]);

  // ---------- Middle mouse button: pan ----------
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let dragging = false;
    let startX = 0, startY = 0, startPanX = 0, startPanY = 0;
    const down = (e: PointerEvent) => {
      if (e.button !== 1) return;
      if (zoomRef.current <= 1) return;
      e.preventDefault();
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      startPanX = panRef.current.x; startPanY = panRef.current.y;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const last = rendererRef.current?.getLastInfo();
      if (!last) return;
      const rect = el.getBoundingClientRect();
      panRef.current = clampPan(
        { x: startPanX + (e.clientX - startX), y: startPanY + (e.clientY - startY) },
        last.cssWidth, last.cssHeight, rect.width, rect.height,
      );
      applyTransform();
    };
    const up = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      try { el.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [applyTransform]);

  // Suppress macOS/Linux middle-click autoscroll cursor.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onAux = (e: MouseEvent) => { if (e.button === 1) e.preventDefault(); };
    el.addEventListener('auxclick', onAux);
    return () => el.removeEventListener('auxclick', onAux);
  }, []);

  // ---------- Keyboard delete while hovering a caliper ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      ) return;
      const id = hoveredCaliperIdRef.current;
      if (!id) return;
      if (e.key === 'Delete' || e.key === 'Backspace' || e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setCalipers((arr) => arr.filter((c) => c.id !== id));
        setHoveredCaliperId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---------- Pointer interactions on the overlay canvas ----------
  const updateOption = useCallback(
    <K extends keyof ViewerOptions>(key: K, value: ViewerOptions[K]) => {
      setOptions((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleStaticClick = useCallback(
    (cssX: number, cssY: number) => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      const hit = renderer.hitTest(cssX, cssY);
      if (!hit) return;
      const opts = optionsRef.current;
      switch (hit.kind) {
        case 'lead':
          if (opts.layout === '6x2' || opts.layout === '3x4') {
            if (hit.leadIndex !== opts.rhythmLead) updateOption('rhythmLead', hit.leadIndex);
          }
          break;
        case 'cycleTime':  updateOption('timeScale',      cycle(TIME_SCALES, opts.timeScale)); break;
        case 'cycleAmp':   updateOption('amplitudeScale', cycle(AMP_SCALES,  opts.amplitudeScale)); break;
        case 'cycleLayout':updateOption('layout',         cycle(LAYOUTS,     opts.layout)); break;
      }
    },
    [updateOption],
  );

  const pointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const renderer = rendererRef.current;
    if (!renderer) return;
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    const startMm = renderer.cssToCanvasMm(cssX, cssY);
    const caliperHit = renderer.hitTestCaliperLabel(cssX, cssY);
    if (caliperHit) {
      const initial = calipersRef.current.find((c) => c.id === caliperHit);
      if (initial) {
        dragRef.current = {
          kind: 'moving', startCss: { x: cssX, y: cssY }, startMm, initialCaliper: initial,
        };
        canvas.setPointerCapture(e.pointerId);
        canvas.style.cursor = 'grabbing';
        return;
      }
    }
    dragRef.current = { kind: 'pending', startCss: { x: cssX, y: cssY }, startMm };
    canvas.setPointerCapture(e.pointerId);
  }, []);

  const pointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    const drag = dragRef.current;

    if (drag.kind === 'pending') {
      const dx = cssX - drag.startCss.x;
      const dy = cssY - drag.startCss.y;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      drag.kind = 'creating';
      canvas.style.cursor = 'crosshair';
    }

    if (drag.kind === 'creating') {
      const cur = renderer.cssToCanvasMm(cssX, cssY);
      const dx = cssX - drag.startCss.x;
      const dy = cssY - drag.startCss.y;
      const mode: Caliper['mode'] = Math.abs(dy) > Math.abs(dx) ? 'amp' : 'time';
      setPreviewCaliper({
        id: '__preview', mode,
        startXmm: drag.startMm.x, startYmm: drag.startMm.y,
        endXmm: cur.x, endYmm: cur.y,
      });
      return;
    }

    if (drag.kind === 'moving' && drag.initialCaliper) {
      const cur = renderer.cssToCanvasMm(cssX, cssY);
      const dxMm = cur.x - drag.startMm.x;
      const dyMm = cur.y - drag.startMm.y;
      const init = drag.initialCaliper;
      setCalipers((arr) =>
        arr.map((c) => c.id === init.id
          ? {
              ...c,
              startXmm: init.startXmm + dxMm, startYmm: init.startYmm + dyMm,
              endXmm: init.endXmm + dxMm,     endYmm: init.endYmm + dyMm,
            }
          : c,
        ),
      );
      return;
    }

    // Idle: hover + cursor
    const calHit = renderer.hitTestCaliperLabel(cssX, cssY);
    if (calHit !== hoveredCaliperIdRef.current) setHoveredCaliperId(calHit);
    if (calHit) {
      canvas.style.cursor = 'grab';
    } else {
      const hit = renderer.hitTest(cssX, cssY);
      const isLeadIn12x1 = hit?.kind === 'lead' && optionsRef.current.layout === '12x1';
      canvas.style.cursor = hit && !isLeadIn12x1 ? 'pointer' : 'crosshair';
    }
  }, []);

  const pointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const canvas = e.currentTarget;
    const drag = dragRef.current;
    if (drag.kind === 'pending') {
      handleStaticClick(drag.startCss.x, drag.startCss.y);
    } else if (drag.kind === 'creating') {
      const preview = previewCaliperRef.current;
      if (preview) {
        const id = `cal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        setCalipers((arr) => [...arr, { ...preview, id }]);
      }
      setPreviewCaliper(null);
    }
    dragRef.current = IDLE_DRAG;
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  }, [handleStaticClick]);

  const pointerLeave = useCallback(() => {
    if (dragRef.current.kind !== 'idle') return;
    if (hoveredCaliperIdRef.current !== null) setHoveredCaliperId(null);
  }, []);

  const resetZoom = useCallback(() => {
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    setZoomDisplay(1);
    triggerRender();
  }, [triggerRender]);

  const clearCalipers = useCallback(() => {
    setCalipers([]);
    setPreviewCaliper(null);
    setHoveredCaliperId(null);
  }, []);

  // ---------- Imperative ref API ----------
  useImperativeHandle(ref, () => ({
    exportPng: () => rendererRef.current?.exportPng() ?? null,
    clearCalipers,
    resetZoom,
    setOption: (key, value) => updateOption(key, value),
    getOptions: () => optionsRef.current,
    refresh: () => triggerRender(),
  }), [clearCalipers, resetZoom, updateOption, triggerRender]);

  const headerInfo = useMemo(() => {
    if (!record) return null;
    return (
      <div className="ecg-meta">
        {record.patientName && <span>{record.patientName}</span>}
        <span>{record.durationSec.toFixed(1)} s</span>
        <span>{record.samplingFrequency} Hz</span>
        {info && Math.abs(info.fitScale - 1) > 0.01 && (
          <span title={info.fitScale < 1
            ? "L'ECG a été réduit pour tenir dans la fenêtre."
            : "L'ECG a été agrandi pour remplir la fenêtre."
          }>
            échelle écran: {info.effectiveTimeScale.toFixed(1)} mm/s ·{' '}
            {info.effectiveAmplitudeScale.toFixed(1)} mm/mV
          </span>
        )}
        {zoomDisplay > 1.001 && (
          <span>
            zoom × {zoomDisplay.toFixed(2)}{' '}
            <button onClick={resetZoom}>réinitialiser</button>
          </span>
        )}
        {calipers.length > 0 && (
          <span>
            {calipers.length} mesure{calipers.length > 1 ? 's' : ''}{' '}
            <button onClick={clearCalipers}>effacer</button>
          </span>
        )}
      </div>
    );
  }, [record, info, zoomDisplay, calipers.length, resetZoom, clearCalipers]);

  return (
    <div ref={viewerRef} className={`ecg-viewer${className ? ` ${className}` : ''}`}>
      {headerInfo}
      <div className="ecg-canvas-frame">
        <div className="ecg-canvas-stage" ref={stageRef}>
          {error && <div className="ecg-error">{error}</div>}
          {!record && !error && (
            <div className="ecg-empty">Aucun ECG chargé.</div>
          )}
          <div className="ecg-canvas-wrap" ref={wrapRef}>
            <canvas
              ref={overlayCanvasRef}
              className="ecg-canvas ecg-canvas-overlay"
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={pointerUp}
              onPointerCancel={pointerUp}
              onPointerLeave={pointerLeave}
            />
            <canvas ref={glCanvasRef} className="ecg-canvas ecg-canvas-gl" />
          </div>
        </div>
      </div>
    </div>
  );
});
