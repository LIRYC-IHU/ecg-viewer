export type { EcgChannel, EcgRecord } from '../shared/ecgTypes';
export { STANDARD_LEADS_12 } from '../shared/ecgTypes';

export type Layout = '12x1' | '6x2' | '3x4';
export type TimeScale = 25 | 50; // mm/s
export type AmplitudeScale = 5 | 10 | 20; // mm/mV

export const TIME_SCALES: readonly TimeScale[] = [25, 50] as const;
export const AMP_SCALES: readonly AmplitudeScale[] = [5, 10, 20] as const;
export const LAYOUTS: readonly Layout[] = ['12x1', '6x2', '3x4'] as const;

/**
 * Configurable display options. Colors and trace thickness are *not* in here:
 * they are controlled via CSS custom properties on the viewer element (see
 * README and `theme.ts`).
 */
export interface ViewerOptions {
  layout: Layout;
  timeScale: TimeScale;
  amplitudeScale: AmplitudeScale;
  /**
   * Lead index (0..11 in STANDARD_LEADS_12 order) shown as a full-duration
   * rhythm strip below the 6×2 / 3×4 layouts. Default = 1 (II).
   */
  rhythmLead: number;
}

/** A caliper measurement stored in canvas-millimeter coordinates. */
export interface Caliper {
  id: string;
  /** 'time' → vertical bars at start.x/end.x, connector horizontal (ms). */
  /** 'amp'  → horizontal bars at start.y/end.y, connector vertical (mV). */
  mode: 'time' | 'amp';
  startXmm: number;
  startYmm: number;
  endXmm: number;
  endYmm: number;
}
