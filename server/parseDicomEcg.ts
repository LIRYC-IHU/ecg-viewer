import dicomParser from 'dicom-parser';
import { STANDARD_LEADS_12 } from '../shared/ecgTypes.ts';
import type { EcgChannel, EcgRecord } from '../shared/ecgTypes.ts';

/**
 * Parse a DICOM Resting 12-Lead ECG (SOP class 1.2.840.10008.5.1.4.1.1.9.1.1).
 * Returns a record with 12 channels in standard order, samples expressed in mV.
 * Missing or flat (all-zero) limb leads are derived from two of I, II and III.
 */
export function parseDicomEcg(input: ArrayBuffer | Uint8Array): EcgRecord {
  const byteArray = input instanceof Uint8Array ? input : new Uint8Array(input);
  const dataSet = dicomParser.parseDicom(byteArray);

  const waveformSeq = dataSet.elements['x54000100'];
  if (!waveformSeq || !waveformSeq.items || waveformSeq.items.length === 0) {
    throw new Error('Aucune Waveform Sequence (5400,0100) trouvée dans le fichier DICOM.');
  }

  const waveform = waveformSeq.items[0].dataSet!;

  const numChannels = waveform.uint16('x003a0005');
  const numSamples = waveform.uint32('x003a0010');
  const samplingFrequencyStr = waveform.string('x003a001a');
  const bitsAllocated = waveform.uint16('x54001004');
  const sampleInterpretation = (waveform.string('x54001006') ?? 'SS').trim();

  if (!numChannels || !numSamples || !samplingFrequencyStr || !bitsAllocated) {
    throw new Error('Métadonnées de waveform DICOM manquantes ou invalides.');
  }
  const samplingFrequency = parseFloat(samplingFrequencyStr);

  const channelDefSeq = waveform.elements['x003a0200'];
  if (!channelDefSeq || !channelDefSeq.items) {
    throw new Error('Channel Definition Sequence (003A,0200) manquante.');
  }

  interface ChannelMeta {
    label: string;
    sensitivity: number;
    sensitivityUnits: string;
    correctionFactor: number;
    baseline: number;
  }

  const channelMetas: ChannelMeta[] = channelDefSeq.items.map((item, idx) => {
    const ds = item.dataSet!;
    let label = `Ch${idx + 1}`;

    const sourceSeq = ds.elements['x003a0208'];
    if (sourceSeq?.items?.length) {
      const sourceDs = sourceSeq.items[0].dataSet!;
      const codeMeaning = sourceDs.string('x00080104');
      if (codeMeaning) label = normalizeLeadName(codeMeaning);
    }

    const sensitivity = parseFloat(ds.string('x003a0210') ?? '1');
    let sensitivityUnits = 'mV';
    const sensUnitsSeq = ds.elements['x003a0211'];
    if (sensUnitsSeq?.items?.length) {
      const ssDs = sensUnitsSeq.items[0].dataSet!;
      sensitivityUnits = (ssDs.string('x00080100') ?? 'mV').trim();
    }
    const correctionFactor = parseFloat(ds.string('x003a0212') ?? '1');
    const baseline = parseFloat(ds.string('x003a0213') ?? '0');

    return { label, sensitivity, sensitivityUnits, correctionFactor, baseline };
  });

  const waveformDataElem = waveform.elements['x54001010'];
  if (!waveformDataElem) throw new Error('Waveform Data (5400,1010) manquante.');

  const bytesPerSample = bitsAllocated / 8;
  if (bytesPerSample !== 1 && bytesPerSample !== 2) {
    throw new Error(`Bits allocated non supporté: ${bitsAllocated}.`);
  }

  const dataView = new DataView(
    byteArray.buffer,
    byteArray.byteOffset + waveformDataElem.dataOffset,
    waveformDataElem.length,
  );

  const isSigned = sampleInterpretation === 'SS' || sampleInterpretation === 'SB';
  const littleEndian = true;

  const rawChannels: Float32Array[] = Array.from(
    { length: numChannels },
    () => new Float32Array(numSamples),
  );

  for (let s = 0; s < numSamples; s++) {
    for (let c = 0; c < numChannels; c++) {
      const byteOffset = (s * numChannels + c) * bytesPerSample;
      let raw: number;
      if (bytesPerSample === 2) {
        raw = isSigned
          ? dataView.getInt16(byteOffset, littleEndian)
          : dataView.getUint16(byteOffset, littleEndian);
      } else {
        raw = isSigned ? dataView.getInt8(byteOffset) : dataView.getUint8(byteOffset);
      }
      rawChannels[c][s] = raw;
    }
  }

  const channelsRaw: EcgChannel[] = channelMetas.map((meta, c) => {
    const unitToMv =
      meta.sensitivityUnits.toLowerCase().includes('uv') || meta.sensitivityUnits === 'µV'
        ? 0.001
        : 1;
    const factor = meta.sensitivity * meta.correctionFactor * unitToMv;
    const baselineMv = meta.baseline * unitToMv;
    const samples = new Float32Array(numSamples);
    for (let s = 0; s < numSamples; s++) {
      samples[s] = rawChannels[c][s] * factor + baselineMv;
    }
    return { label: meta.label, samples };
  });

  // Some converters emit every standard channel even when the source lacked
  // it, filled with zeros (ecg-bridge does so for unrecognised lead codes such
  // as MDC_ECG_LEAD_aVR): a flat channel only stands in when nothing better can
  // be derived.
  const measured = new Map<string, EcgChannel>();
  const flat = new Map<string, EcgChannel>();
  for (const ch of channelsRaw) {
    const target = isFlat(ch.samples) ? flat : measured;
    if (!target.has(ch.label)) target.set(ch.label, ch);
  }

  const finalChannels: EcgChannel[] = STANDARD_LEADS_12.map(
    (leadName) =>
      measured.get(leadName) ??
      deriveLimbLead(leadName, measured, numSamples) ??
      flat.get(leadName) ??
      missingLead(leadName),
  );

  const durationSec = numSamples / samplingFrequency;

  return {
    channels: finalChannels,
    samplingFrequency,
    durationSec,
    patientName: dataSet.string('x00100010') ?? undefined,
    acquisitionDate: dataSet.string('x00080023') ?? undefined,
    rawLeadOrder: channelMetas.map((m) => m.label),
  };
}

/** Limb leads as functions of I and II (Einthoven's and Goldberger's laws). */
const LIMB_LEADS_FROM_I_II: Record<string, (i: number, ii: number) => number> = {
  I: (i) => i,
  II: (_i, ii) => ii,
  III: (i, ii) => ii - i,
  aVR: (i, ii) => -(i + ii) * 0.5,
  aVL: (i, ii) => i - ii * 0.5,
  aVF: (i, ii) => ii - i * 0.5,
};

/**
 * Derive a limb lead from any two of I, II and III; null if `leadName` is not a
 * limb lead or fewer than two of those were measured.
 */
function deriveLimbLead(
  leadName: string,
  measured: Map<string, EcgChannel>,
  n: number,
): EcgChannel | null {
  const formula = LIMB_LEADS_FROM_I_II[leadName];
  if (!formula) return null;
  let I = measured.get('I')?.samples;
  let II = measured.get('II')?.samples;
  const III = measured.get('III')?.samples;
  if (!I && II && III) I = combine(n, II, III, (ii, iii) => ii - iii);
  if (!II && I && III) II = combine(n, I, III, (i, iii) => i + iii);
  if (!I || !II) return null;
  return { label: leadName, samples: combine(n, I, II, formula) };
}

function combine(
  n: number,
  a: Float32Array,
  b: Float32Array,
  f: (a: number, b: number) => number,
): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = f(a[i], b[i]);
  return out;
}

/** Whether every sample has the same value (an empty placeholder channel). */
function isFlat(samples: Float32Array): boolean {
  for (let i = 1; i < samples.length; i++) {
    if (samples[i] !== samples[0]) return false;
  }
  return true;
}

function missingLead(leadName: string): never {
  if (leadName in LIMB_LEADS_FROM_I_II) {
    throw new Error(
      `Dérivation ${leadName} absente et impossible à dériver (deux voies parmi I, II et III requises).`,
    );
  }
  throw new Error(`Dérivation ${leadName} absente du fichier.`);
}

function normalizeLeadName(raw: string): string {
  const s = raw.trim().toLowerCase().replace(/^lead\s+/, '').replace(/\s+/g, '');
  const map: Record<string, string> = {
    i: 'I',
    ii: 'II',
    iii: 'III',
    avr: 'aVR',
    avl: 'aVL',
    avf: 'aVF',
    v1: 'V1', v2: 'V2', v3: 'V3', v4: 'V4', v5: 'V5', v6: 'V6',
    einthoveni: 'I',
    einthovenii: 'II',
    einthoveniii: 'III',
  };
  return map[s] ?? raw.trim();
}
