import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SNIFF_BYTES, findEcgSopClass, isCandidate } from './sniff';

const SAMPLES = path.resolve(__dirname, '../../../server/samples');
const ascii = (s: string) => new TextEncoder().encode(s);

describe('findEcgSopClass', () => {
  it('detects every bundled sample from the head of the file alone', () => {
    const files = readdirSync(SAMPLES).filter((f) => f.endsWith('.dcm'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const head = readFileSync(path.join(SAMPLES, f)).subarray(0, SNIFF_BYTES);
      expect(findEcgSopClass(head), f).not.toBeNull();
    }
  });

  it('matches a UID padded with NUL or space, as DICOM stores it', () => {
    expect(findEcgSopClass(ascii('xx1.2.840.10008.5.1.4.1.1.9.1.1\0yy'))).toBe(
      '1.2.840.10008.5.1.4.1.1.9.1.1',
    );
    expect(findEcgSopClass(ascii('1.2.840.10008.5.1.4.1.1.9.1.3 '))).toBe(
      '1.2.840.10008.5.1.4.1.1.9.1.3',
    );
  });

  it('ignores longer UIDs that merely contain an ECG one', () => {
    expect(findEcgSopClass(ascii('\x001.2.840.10008.5.1.4.1.1.9.1.10\0'))).toBeNull();
    expect(findEcgSopClass(ascii('\x002.1.2.840.10008.5.1.4.1.1.9.1.1\0'))).toBeNull();
  });

  it('rejects other SOP classes (CT image)', () => {
    expect(findEcgSopClass(ascii('\x001.2.840.10008.5.1.4.1.1.2\0'))).toBeNull();
  });
});

describe('isCandidate', () => {
  const f = (name: string, extra: object = {}) => ({ name, size: 1000, ...extra });

  it('accepts DICOM-looking names', () => {
    expect(isCandidate(f('ecg.dcm'))).toBe(true);
    expect(isCandidate(f('ECG.DCM'))).toBe(true);
    expect(isCandidate(f('IM0001'))).toBe(true);
    expect(isCandidate(f('1.2.840.113619.2.55.3.604688'))).toBe(true);
    expect(isCandidate(f('blob.bin', { mimeType: 'application/dicom' }))).toBe(true);
  });

  it('rejects other files, links, empty and oversized files', () => {
    expect(isCandidate(f('report.pdf'))).toBe(false);
    expect(isCandidate(f('ecg.dcm', { linkUrl: 'http://x' }))).toBe(false);
    expect(isCandidate(f('ecg.dcm', { size: 0 }))).toBe(false);
    expect(isCandidate(f('ecg.dcm', { size: 1e9 }))).toBe(false);
  });
});
