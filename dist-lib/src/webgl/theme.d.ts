/**
 * Theme reading from CSS custom properties.
 *
 * Every visual aspect of the viewer (background, grid, labels, trace,
 * caliper accent, chip surfaces, trace thickness) is sourced from CSS
 * variables on a host element, so consumers can theme the component
 * without touching the renderer.
 *
 * Recognized variables (with fallbacks):
 *   --ecg-bg                background fill
 *   --ecg-grid-minor        1-mm grid lines
 *   --ecg-grid-major        5-mm grid lines
 *   --ecg-label             lead names and column-join bars
 *   --ecg-trace             ECG trace color
 *   --ecg-trace-thickness   trace thickness in CSS pixels (e.g. "1px")
 *   --ecg-accent            calipers, rhythm-strip marker
 *   --ecg-ui-chip-bg        background of clickable chips and caliper labels
 *   --ecg-ui-chip-border    border of those chips
 */
export interface Theme {
    background: string;
    gridMinor: string;
    gridMajor: string;
    label: string;
    accent: string;
    /** Trace color as RGB floats in [0, 1] (passed to a WebGL uniform). */
    trace: [number, number, number];
    chipBg: string;
    chipBorder: string;
    traceThicknessPx: number;
}
export declare function readTheme(host: HTMLElement): Theme;
/** Convert any valid CSS color to RGB floats in [0, 1]. */
export declare function cssColorToRgb(css: string): [number, number, number];
/** Re-emit a CSS color with a given alpha (used for chip hover highlight). */
export declare function withAlpha(color: string, alpha: number): string;
