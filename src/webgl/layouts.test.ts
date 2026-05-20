import { describe, it, expect } from 'vitest';
import { getLayoutGrid, LEAD_NAMES, layoutLabel } from './layouts';

describe('layouts', () => {
  it('exposes 12 lead names in canonical order', () => {
    expect(LEAD_NAMES).toEqual([
      'I', 'II', 'III', 'aVR', 'aVL', 'aVF',
      'V1', 'V2', 'V3', 'V4', 'V5', 'V6',
    ]);
  });

  it('12×1 is a single column listing every lead', () => {
    const g = getLayoutGrid('12x1');
    expect(g.rows).toBe(12);
    expect(g.cols).toBe(1);
    const flat = g.leadIndex.flat();
    expect(flat).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('6×2 places limb leads left and precordial right', () => {
    const g = getLayoutGrid('6x2');
    expect(g.rows).toBe(6);
    expect(g.cols).toBe(2);
    // Column 0 → limb leads (I..aVF), column 1 → precordial (V1..V6)
    const col0 = g.leadIndex.map((row) => row[0]);
    const col1 = g.leadIndex.map((row) => row[1]);
    expect(col0).toEqual([0, 1, 2, 3, 4, 5]);
    expect(col1).toEqual([6, 7, 8, 9, 10, 11]);
  });

  it('3×4 matches the standard clinical arrangement', () => {
    const g = getLayoutGrid('3x4');
    expect(g.rows).toBe(3);
    expect(g.cols).toBe(4);
    expect(g.leadIndex).toEqual([
      [0, 3, 6, 9],    // I,  aVR, V1, V4
      [1, 4, 7, 10],   // II, aVL, V2, V5
      [2, 5, 8, 11],   // III,aVF, V3, V6
    ]);
  });

  it('every layout references each of the 12 leads exactly once', () => {
    for (const layout of ['12x1', '6x2', '3x4'] as const) {
      const flat = getLayoutGrid(layout).leadIndex.flat().sort((a, b) => a - b);
      expect(flat).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    }
  });

  it('layoutLabel produces concise human-readable strings', () => {
    expect(layoutLabel('12x1')).toBe('12 × 1');
    expect(layoutLabel('6x2')).toBe('6 × 2');
    expect(layoutLabel('3x4')).toBe('3 × 4');
  });
});
