import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDicomEcg } from './parseDicomEcg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = path.join(__dirname, 'samples');

function parseSample(id: string) {
  const buf = readFileSync(path.join(SAMPLES_DIR, `${id}.dcm`));
  return parseDicomEcg(new Uint8Array(buf));
}

const STANDARD_LEADS = [
  'I', 'II', 'III', 'aVR', 'aVL', 'aVF',
  'V1', 'V2', 'V3', 'V4', 'V5', 'V6',
] as const;

describe('parseDicomEcg', () => {
  const sampleIds = readdirSync(SAMPLES_DIR)
    .filter((f) => f.toLowerCase().endsWith('.dcm'))
    .map((f) => path.basename(f, path.extname(f)))
    .sort();

  it('discovers at least one sample on disk', () => {
    expect(sampleIds.length).toBeGreaterThan(0);
  });

  for (const id of sampleIds) {
    describe(`sample ${id}`, () => {
      const rec = parseSample(id);

      it('parses 12 standard leads in canonical order', () => {
        expect(rec.channels).toHaveLength(12);
        expect(rec.channels.map((c) => c.label)).toEqual([...STANDARD_LEADS]);
      });

      it('has a non-zero positive sampling frequency', () => {
        expect(rec.samplingFrequency).toBeGreaterThan(0);
        expect(Number.isFinite(rec.samplingFrequency)).toBe(true);
      });

      it('duration is samples / samplingFrequency', () => {
        const expected = rec.channels[0].samples.length / rec.samplingFrequency;
        expect(rec.durationSec).toBeCloseTo(expected, 6);
      });

      it('all channels have the same length', () => {
        const n = rec.channels[0].samples.length;
        for (const c of rec.channels) expect(c.samples.length).toBe(n);
      });

      it('samples are finite (no NaN/Infinity)', () => {
        for (const c of rec.channels) {
          const s = c.samples;
          for (let i = 0; i < Math.min(s.length, 200); i++) {
            expect(Number.isFinite(s[i])).toBe(true);
          }
        }
      });

      it('Einthoven law: III ≈ II − I (whether derived or measured)', () => {
        const I = rec.channels[0].samples;
        const II = rec.channels[1].samples;
        const III = rec.channels[2].samples;
        // Check on a few sample points (allowing small rounding from sensitivity scaling)
        for (const idx of [0, 50, 100, 500, 1000]) {
          if (idx >= I.length) continue;
          expect(III[idx]).toBeCloseTo(II[idx] - I[idx], 3);
        }
      });
    });
  }

  // ecg-bridge 1.4.0 converted this FDA aECG, whose augmented leads are coded
  // MDC_ECG_LEAD_aVR/aVL/aVF, into a DICOM whose aVR, aVL and aVF are all zeros.
  describe('flat augmented leads', () => {
    const rec = parseSample('flat-augmented');
    const lead = (name: string) => rec.channels[STANDARD_LEADS.indexOf(name as never)].samples;

    it('derives aVR, aVL and aVF from I and II instead of keeping the zeros', () => {
      const I = lead('I');
      const II = lead('II');
      for (const name of ['aVR', 'aVL', 'aVF']) {
        expect(lead(name).some((v) => v !== 0)).toBe(true);
      }
      for (const idx of [0, 50, 100, 500, 1000]) {
        expect(lead('aVR')[idx]).toBeCloseTo(-(I[idx] + II[idx]) / 2, 5);
        expect(lead('aVL')[idx]).toBeCloseTo(I[idx] - II[idx] / 2, 5);
        expect(lead('aVF')[idx]).toBeCloseTo(II[idx] - I[idx] / 2, 5);
      }
    });

    it('keeps the measured leads', () => {
      expect(Math.max(...lead('V3'))).toBeGreaterThan(0.5);
    });
  });
});
