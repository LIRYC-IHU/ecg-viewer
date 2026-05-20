import { Caliper, EcgRecord, ViewerOptions } from '../types';
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
export type LabelHit = {
    kind: 'lead';
    leadIndex: number;
} | {
    kind: 'cycleTime';
} | {
    kind: 'cycleAmp';
} | {
    kind: 'cycleLayout';
};
export interface RenderDecoration {
    calipers?: Caliper[];
    preview?: Caliper | null;
    hoveredCaliperId?: string | null;
    /** Cursor position in canvas-mm; drawn as a dashed vertical guideline. */
    crosshair?: {
        x: number;
        y: number;
    } | null;
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
export declare class EcgRenderer {
    private glCanvas;
    private overlayCanvas;
    /** Element to read theme CSS variables from. */
    private themeHost;
    private gl;
    private overlayCtx;
    private program;
    private locs;
    /** Per-channel expanded vertex buffer (2N vertices × 7 floats). */
    private buffers;
    private record;
    private options;
    private lastInfo;
    private hits;
    private caliperHits;
    /** Stored each render() so screen↔canvas-mm conversion works post-render. */
    private lastPxPerMm;
    /** Hard cap on canvas internal pixels along one axis (driver/GPU limit). */
    private maxInternalPx;
    constructor(glCanvas: HTMLCanvasElement, overlayCanvas: HTMLCanvasElement, 
    /** Element to read theme CSS variables from. */
    themeHost: HTMLElement, options: ViewerOptions);
    setData(record: EcgRecord): void;
    setOptions(options: ViewerOptions): void;
    getLastInfo(): RenderInfo | null;
    hitTest(cssX: number, cssY: number): LabelHit | null;
    hitTestCaliperLabel(cssX: number, cssY: number): string | null;
    cssToCanvasMm(cssX: number, cssY: number): {
        x: number;
        y: number;
    };
    render(containerCssWidth: number, containerCssHeight: number, zoom?: number, deco?: RenderDecoration): RenderInfo | null;
    exportPng(): string;
    dispose(): void;
    private drawTraceSegment;
    private drawOverlay;
    private drawCrosshair;
    private drawGrid;
    private drawColumnSeparators;
    private drawLeadLabels;
    private drawRhythmStripLabel;
    private drawLayoutChip;
    private drawScaleChips;
    private drawCaliper;
    private drawLeadLabelText;
    private drawChip;
}
