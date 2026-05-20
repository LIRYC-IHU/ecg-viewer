import { Layout } from '../types';
export declare const LEAD_NAMES: readonly ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"];
export interface LayoutGrid {
    rows: number;
    cols: number;
    /** leadIndex[row][col] → index into the 12 standard leads (0..11), or -1. */
    leadIndex: number[][];
}
export declare function getLayoutGrid(layout: Layout): LayoutGrid;
export declare function layoutLabel(layout: Layout): string;
