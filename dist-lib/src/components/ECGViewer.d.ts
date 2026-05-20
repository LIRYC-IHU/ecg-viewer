import { EcgRecord, ViewerOptions } from '../types';
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
    /** Undo the most recent caliper change. */
    undo(): void;
    /** Redo the most recently undone caliper change. */
    redo(): void;
    /** Reset zoom (1×) and pan. */
    resetZoom(): void;
    /** Toggle browser fullscreen on the viewer root element. */
    toggleFullscreen(): void;
    /** Programmatically update a single option. */
    setOption<K extends keyof ViewerOptions>(key: K, value: ViewerOptions[K]): void;
    /** Read the live options snapshot. */
    getOptions(): ViewerOptions;
    /** Re-read CSS theme variables and redraw (call after live CSS changes). */
    refresh(): void;
}
export declare const ECGViewer: import('react').ForwardRefExoticComponent<ECGViewerProps & import('react').RefAttributes<ECGViewerHandle>>;
