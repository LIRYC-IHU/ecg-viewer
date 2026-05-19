/**
 * Types shared between the Node backend and the browser client.
 * Samples are stored in mV as Float32Array on both sides; on the wire
 * they are transmitted as a raw Float32 little-endian buffer.
 */

export interface EcgChannel {
  /** Standard lead name: I, II, III, aVR, aVL, aVF, V1..V6. */
  label: string;
  /** Sample values in millivolts. */
  samples: Float32Array;
}

export interface EcgRecord {
  /** Always 12 channels in standard order: I, II, III, aVR, aVL, aVF, V1..V6. */
  channels: EcgChannel[];
  /** Acquisition sampling frequency (Hz). */
  samplingFrequency: number;
  /** Total duration in seconds. */
  durationSec: number;
  patientName?: string;
  acquisitionDate?: string;
  /** Names of channels found in the raw DICOM, before reordering/derivation. */
  rawLeadOrder?: string[];
}

export const STANDARD_LEADS_12 = [
  'I', 'II', 'III', 'aVR', 'aVL', 'aVF',
  'V1', 'V2', 'V3', 'V4', 'V5', 'V6',
] as const;

/**
 * Metadata portion of the binary wire format (JSON, padded to 4 bytes).
 * The binary layout is:
 *
 *   uint32 LE  jsonLength
 *   jsonLength bytes  UTF-8 JSON (this object) — padded to multiple of 4
 *   N × samples × 4 bytes  Float32 little-endian, channel-major
 *                          (channel 0 samples, then channel 1, etc.)
 */
export interface EcgRecordMetaWire {
  numChannels: number;
  numSamples: number;
  samplingFrequency: number;
  durationSec: number;
  patientName?: string;
  acquisitionDate?: string;
  rawLeadOrder?: string[];
  /** Channel labels in the order they appear in the sample buffer. */
  channelLabels: string[];
}
