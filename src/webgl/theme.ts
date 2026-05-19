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

export function readTheme(host: HTMLElement): Theme {
  const cs = getComputedStyle(host);
  const read = (name: string, fallback: string) =>
    cs.getPropertyValue(name).trim() || fallback;
  const thicknessRaw = read('--ecg-trace-thickness', '1');
  return {
    background: read('--ecg-bg', '#ffffff'),
    gridMinor: read('--ecg-grid-minor', '#d6d6d6'),
    gridMajor: read('--ecg-grid-major', '#7a7a7a'),
    label: read('--ecg-label', '#000000'),
    accent: read('--ecg-accent', '#1f3a8a'),
    chipBg: read('--ecg-ui-chip-bg', 'rgba(255,255,255,0.7)'),
    chipBorder: read('--ecg-ui-chip-border', 'rgba(0,0,0,0.1)'),
    trace: cssColorToRgb(read('--ecg-trace', '#000000')),
    traceThicknessPx: Math.max(0.5, parseFloat(thicknessRaw) || 1),
  };
}

/** Convert any valid CSS color to RGB floats in [0, 1]. */
export function cssColorToRgb(css: string): [number, number, number] {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return [0, 0, 0];
  ctx.fillStyle = '#000';
  ctx.fillStyle = css;
  const s = ctx.fillStyle as string;
  if (s.startsWith('#') && s.length === 7) {
    return [
      parseInt(s.slice(1, 3), 16) / 255,
      parseInt(s.slice(3, 5), 16) / 255,
      parseInt(s.slice(5, 7), 16) / 255,
    ];
  }
  const m = s.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const parts = m[1].split(',').map((x) => parseFloat(x.trim()));
    return [parts[0] / 255, parts[1] / 255, parts[2] / 255];
  }
  return [0, 0, 0];
}

/** Re-emit a CSS color with a given alpha (used for chip hover highlight). */
export function withAlpha(color: string, alpha: number): string {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return color;
  ctx.fillStyle = '#000';
  ctx.fillStyle = color;
  const s = ctx.fillStyle as string;
  if (s.startsWith('#') && s.length === 7) {
    const r = parseInt(s.slice(1, 3), 16);
    const g = parseInt(s.slice(3, 5), 16);
    const b = parseInt(s.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const m = s.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const parts = m[1].split(',').map((x) => parseFloat(x.trim()));
    return `rgba(${parts[0]},${parts[1]},${parts[2]},${alpha})`;
  }
  return color;
}
