import type { EcgRecord } from './types';
import type { EcgRecordMetaWire } from '../shared/ecgTypes';

export interface SampleInfo {
  id: string;
  file: string;
}

export async function listSamples(): Promise<SampleInfo[]> {
  const res = await fetch('/api/samples');
  if (!res.ok) throw new Error(`HTTP ${res.status} sur /api/samples`);
  return res.json();
}

export async function loadSample(id: string): Promise<EcgRecord> {
  const res = await fetch(`/api/samples/${encodeURIComponent(id)}`);
  if (!res.ok) {
    throw new Error(`Échantillon ${id} : ${await errorMessage(res)}`);
  }
  return decodeRecord(await res.arrayBuffer());
}

export async function uploadDicom(file: File): Promise<EcgRecord> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/parse', { method: 'POST', body: form });
  if (!res.ok) {
    throw new Error(await errorMessage(res));
  }
  return decodeRecord(await res.arrayBuffer());
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const j = await res.json();
    return j.error ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

/**
 * Decode the binary wire format produced by encodeRecord on the server:
 *   uint32 LE        json length (multiple of 4)
 *   N bytes          UTF-8 JSON (EcgRecordMetaWire), space-padded
 *   M × 4 bytes      Float32 LE samples, concatenated channel by channel
 */
export function decodeRecord(buf: ArrayBuffer): EcgRecord {
  if (buf.byteLength < 4) {
    throw new Error('Réponse trop courte.');
  }
  const dv = new DataView(buf);
  const jsonLen = dv.getUint32(0, true);
  if (jsonLen % 4 !== 0 || 4 + jsonLen > buf.byteLength) {
    throw new Error('Entête binaire invalide.');
  }
  const json = new TextDecoder('utf-8').decode(new Uint8Array(buf, 4, jsonLen));
  const meta = JSON.parse(json) as EcgRecordMetaWire;

  const samplesStart = 4 + jsonLen; // multiple of 4 thanks to padding
  const expectedBytes = meta.numChannels * meta.numSamples * 4;
  if (samplesStart + expectedBytes > buf.byteLength) {
    throw new Error('Réponse binaire tronquée.');
  }

  const channels = meta.channelLabels.map((label, i) => {
    const offset = samplesStart + i * meta.numSamples * 4;
    return {
      label,
      // The Float32Array view shares the underlying ArrayBuffer — no copy.
      samples: new Float32Array(buf, offset, meta.numSamples),
    };
  });

  return {
    channels,
    samplingFrequency: meta.samplingFrequency,
    durationSec: meta.durationSec,
    patientName: meta.patientName,
    acquisitionDate: meta.acquisitionDate,
    rawLeadOrder: meta.rawLeadOrder,
  };
}
