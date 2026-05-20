import { describe, it, expect } from 'vitest';
import {
  encodeRecord,
  decodeRecord,
  truncateRecord,
} from './wireFormat';
import type { EcgRecord } from './ecgTypes';

function makeRecord(numChannels = 12, numSamples = 100, fs = 500): EcgRecord {
  const channels = Array.from({ length: numChannels }, (_, c) => {
    const samples = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      // Distinct deterministic values per (channel, sample).
      samples[i] = c * 100 + i * 0.01;
    }
    return { label: `Ch${c}`, samples };
  });
  return {
    channels,
    samplingFrequency: fs,
    durationSec: numSamples / fs,
    patientName: 'Test Patient',
    acquisitionDate: '20260101',
  };
}

describe('wireFormat', () => {
  it('roundtrip preserves channels and metadata exactly', () => {
    const original = makeRecord();
    const wire = encodeRecord(original);
    const decoded = decodeRecord(wire);

    expect(decoded.channels.length).toBe(original.channels.length);
    expect(decoded.samplingFrequency).toBe(original.samplingFrequency);
    expect(decoded.durationSec).toBe(original.durationSec);
    expect(decoded.patientName).toBe(original.patientName);
    expect(decoded.acquisitionDate).toBe(original.acquisitionDate);

    for (let c = 0; c < original.channels.length; c++) {
      expect(decoded.channels[c].label).toBe(original.channels[c].label);
      // Float32 → bytes → Float32 is lossless.
      expect(Array.from(decoded.channels[c].samples))
        .toEqual(Array.from(original.channels[c].samples));
    }
  });

  it('pads the JSON header to 4-byte alignment', () => {
    const wire = encodeRecord(makeRecord());
    const jsonLen = new DataView(wire.buffer, wire.byteOffset).getUint32(0, true);
    expect(jsonLen % 4).toBe(0);
    // The sample section starts at offset 4 + jsonLen and must be 4-aligned
    // for the client to build a Float32Array view at zero copy.
    expect((4 + jsonLen) % 4).toBe(0);
  });

  it('decoded samples are zero-copy views over the source buffer', () => {
    const wire = encodeRecord(makeRecord(2, 50));
    const decoded = decodeRecord(wire);
    expect(decoded.channels[0].samples.buffer).toBe(wire.buffer);
  });

  it('rejects a truncated payload', () => {
    const wire = encodeRecord(makeRecord(2, 50));
    const truncated = wire.subarray(0, wire.length - 100);
    expect(() => decodeRecord(truncated)).toThrow(/truncated/i);
  });

  it('rejects an unaligned JSON header', () => {
    const bad = new Uint8Array(8);
    // jsonLength = 1 (not a multiple of 4)
    new DataView(bad.buffer).setUint32(0, 1, true);
    expect(() => decodeRecord(bad)).toThrow(/Invalid wire header/i);
  });

  describe('truncateRecord', () => {
    it('clips to the requested duration', () => {
      const rec = makeRecord(12, 1000, 100); // 10 s
      const clipped = truncateRecord(rec, 5);
      expect(clipped.durationSec).toBe(5);
      expect(clipped.channels[0].samples.length).toBe(500);
      // Samples are subarrays — first values must be preserved bit-exactly.
      expect(clipped.channels[3].samples[0]).toBe(rec.channels[3].samples[0]);
      expect(clipped.channels[3].samples[499]).toBe(rec.channels[3].samples[499]);
    });

    it('is a no-op when already shorter than maxSeconds', () => {
      const rec = makeRecord(12, 100, 100); // 1 s
      const clipped = truncateRecord(rec, 10);
      expect(clipped).toBe(rec);
    });
  });
});
