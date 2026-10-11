/**
 * Cheap "is this file a DICOM ECG?" check, run on the first few KB of a file.
 *
 * A DICOM ECG declares its SOP Class UID twice near the start of the file:
 * in the file meta header (0002,0002) and in the dataset (0008,0016). Both are
 * plain ASCII, so a byte search over the head of the file is enough — no DICOM
 * parsing, and no need to download the whole file to rule it out.
 */

/** Waveform SOP classes the viewer can display (all ECG flavours). */
export const ECG_SOP_CLASSES = {
  '1.2.840.10008.5.1.4.1.1.9.1.1': '12-lead ECG',
  '1.2.840.10008.5.1.4.1.1.9.1.2': 'General ECG',
  '1.2.840.10008.5.1.4.1.1.9.1.3': 'Ambulatory ECG',
} as const;

export type EcgSopClassUid = keyof typeof ECG_SOP_CLASSES;

/** Bytes to fetch from the head of a candidate file. */
export const SNIFF_BYTES = 16 * 1024;

const UID_BYTES: [EcgSopClassUid, Uint8Array][] = (
  Object.keys(ECG_SOP_CLASSES) as EcgSopClassUid[]
).map((uid) => [uid, new TextEncoder().encode(uid)]);

const DOT = 0x2e;
const ZERO = 0x30;
const NINE = 0x39;

function isUidChar(b: number | undefined): boolean {
  return b !== undefined && (b === DOT || (b >= ZERO && b <= NINE));
}

function indexOfBytes(haystack: Uint8Array, needle: Uint8Array, from: number): number {
  const last = haystack.length - needle.length;
  outer: for (let i = from; i <= last; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/**
 * Return the ECG SOP Class UID found in `head`, or `null`. A match must stand
 * on its own: a longer UID that merely starts with an ECG one (e.g. a
 * hypothetical `…9.1.10`) is not a match.
 */
export function findEcgSopClass(head: Uint8Array): EcgSopClassUid | null {
  for (const [uid, bytes] of UID_BYTES) {
    let at = indexOfBytes(head, bytes, 0);
    while (at !== -1) {
      if (!isUidChar(head[at - 1]) && !isUidChar(head[at + bytes.length])) return uid;
      at = indexOfBytes(head, bytes, at + 1);
    }
  }
  return null;
}

/** Girder file fields used to pick which files are worth sniffing. */
export interface FileLike {
  name: string;
  size?: number;
  mimeType?: string;
  linkUrl?: string;
}

/** Larger files are not offered: the whole file is parsed in the browser. */
export const MAX_ECG_BYTES = 64 * 1024 * 1024;

/**
 * Whether a file could plausibly be a DICOM ECG. DICOM files are often stored
 * without extension or named after their UID (`1.2.840.…`), so both are
 * candidates too.
 */
export function isCandidate(file: FileLike): boolean {
  if (file.linkUrl) return false;
  if (!file.size || file.size > MAX_ECG_BYTES) return false;
  if (file.mimeType && /dicom/i.test(file.mimeType)) return true;
  const name = file.name.toLowerCase();
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return true;
  const ext = name.slice(dot + 1);
  return /^\d+$/.test(ext) || ['dcm', 'dicom', 'dic', 'ecg'].includes(ext);
}
