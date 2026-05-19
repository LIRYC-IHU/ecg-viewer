import type { Layout } from '../types';

export const LEAD_NAMES = [
  'I', 'II', 'III', 'aVR', 'aVL', 'aVF',
  'V1', 'V2', 'V3', 'V4', 'V5', 'V6',
] as const;

export interface LayoutGrid {
  rows: number;
  cols: number;
  /** leadIndex[row][col] → index into the 12 standard leads (0..11), or -1. */
  leadIndex: number[][];
}

export function getLayoutGrid(layout: Layout): LayoutGrid {
  switch (layout) {
    case '12x1':
      return {
        rows: 12, cols: 1,
        leadIndex: [[0],[1],[2],[3],[4],[5],[6],[7],[8],[9],[10],[11]],
      };
    case '6x2':
      // 6 rows × 2 cols: limb leads | precordial
      return {
        rows: 6, cols: 2,
        leadIndex: [
          [0, 6], [1, 7], [2, 8],
          [3, 9], [4, 10], [5, 11],
        ],
      };
    case '3x4':
      // 3 rows × 4 cols (clinical standard)
      return {
        rows: 3, cols: 4,
        leadIndex: [
          [0, 3, 6, 9],
          [1, 4, 7, 10],
          [2, 5, 8, 11],
        ],
      };
  }
}

export function layoutLabel(layout: Layout): string {
  switch (layout) {
    case '12x1': return '12 × 1';
    case '6x2':  return '6 × 2';
    case '3x4':  return '3 × 4';
  }
}
