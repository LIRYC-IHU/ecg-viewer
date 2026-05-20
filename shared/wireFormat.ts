/**
 * Binary wire format for transferring `EcgRecord`s between server and client.
 *
 * Layout:
 *   [ uint32 LE    : jsonLength (multiple of 4 thanks to padding)         ]
 *   [ jsonLength bytes : UTF-8 JSON `EcgRecordMetaWire`, space-padded     ]
 *   [ numChannels × numSamples × 4 bytes : Float32 LE, channel-major     ]
 *
 * The sample bytes are channel-contiguous (all of channel 0, then all of
 * channel 1, …) so the client can build a `Float32Array` view directly over
 * the response `ArrayBuffer` with zero copy.
 *
 * This module is pure: it uses only standard `Uint8Array` / `DataView` /
 * `TextEncoder` / `TextDecoder` so it runs unmodified in Node and the browser.
 */

import type { EcgRecord, EcgRecordMetaWire } from './ecgTypes';

const TEXT_DECODER = new TextDecoder('utf-8');
const TEXT_ENCODER = new TextEncoder();

/**
 * Serialize a record into the binary wire format. Returns a Uint8Array whose
 * underlying buffer is the contiguous payload — pass it as the HTTP body.
 */
export function encodeRecord(record: EcgRecord): Uint8Array {
  const meta: EcgRecordMetaWire = {
    numChannels: record.channels.length,
    numSamples: record.channels[0]?.samples.length ?? 0,
    samplingFrequency: record.samplingFrequency,
    durationSec: record.durationSec,
    patientName: record.patientName,
    acquisitionDate: record.acquisitionDate,
    rawLeadOrder: record.rawLeadOrder,
    channelLabels: record.channels.map((c) => c.label),
  };

  let json = TEXT_ENCODER.encode(JSON.stringify(meta));
  // Pad with spaces so the sample-section starts on a 4-byte boundary
  // (required for Float32Array views in the browser).
  const pad = (4 - (json.length % 4)) % 4;
  if (pad > 0) {
    const padded = new Uint8Array(json.length + pad);
    padded.set(json);
    padded.fill(0x20, json.length); // ASCII space — still valid JSON whitespace
    json = padded;
  }

  const samplesBytes = record.channels.reduce(
    (sum, c) => sum + c.samples.byteLength,
    0,
  );
  const out = new Uint8Array(4 + json.length + samplesBytes);
  new DataView(out.buffer).setUint32(0, json.length, true);
  out.set(json, 4);
  let offset = 4 + json.length;
  for (const ch of record.channels) {
    out.set(
      new Uint8Array(ch.samples.buffer, ch.samples.byteOffset, ch.samples.byteLength),
      offset,
    );
    offset += ch.samples.byteLength;
  }
  return out;
}

/**
 * Decode the wire format produced by `encodeRecord`. Sample arrays are
 * zero-copy `Float32Array` views over the input buffer.
 */
export function decodeRecord(input: ArrayBuffer | Uint8Array): EcgRecord {
  const u8 = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (u8.byteLength < 4) throw new Error('Wire payload too short.');
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const jsonLen = dv.getUint32(0, true);
  if (jsonLen % 4 !== 0 || 4 + jsonLen > u8.byteLength) {
    throw new Error('Invalid wire header.');
  }
  const meta = JSON.parse(
    TEXT_DECODER.decode(u8.subarray(4, 4 + jsonLen)),
  ) as EcgRecordMetaWire;

  const samplesStart = u8.byteOffset + 4 + jsonLen;
  const expectedBytes = meta.numChannels * meta.numSamples * 4;
  // Use the *view* end, not the underlying buffer — callers may pass a
  // narrowed subarray and we want to detect short payloads.
  const viewEnd = u8.byteOffset + u8.byteLength;
  if (samplesStart + expectedBytes > viewEnd) {
    throw new Error('Wire payload truncated.');
  }

  const channels = meta.channelLabels.map((label, i) => ({
    label,
    samples: new Float32Array(
      u8.buffer,
      samplesStart + i * meta.numSamples * 4,
      meta.numSamples,
    ),
  }));

  return {
    channels,
    samplingFrequency: meta.samplingFrequency,
    durationSec: meta.durationSec,
    patientName: meta.patientName,
    acquisitionDate: meta.acquisitionDate,
    rawLeadOrder: meta.rawLeadOrder,
  };
}

/**
 * Clip every channel to the first `maxSeconds` of recording. No-op if the
 * record is already shorter. Shares the underlying sample buffer (via
 * `Float32Array.subarray`) — does not copy.
 */
export function truncateRecord(record: EcgRecord, maxSeconds: number): EcgRecord {
  const maxSamples = Math.floor(record.samplingFrequency * maxSeconds);
  const currentSamples = record.channels[0]?.samples.length ?? 0;
  if (currentSamples <= maxSamples) return record;
  return {
    ...record,
    channels: record.channels.map((c) => ({
      label: c.label,
      samples: c.samples.subarray(0, maxSamples),
    })),
    durationSec: maxSamples / record.samplingFrequency,
  };
}
