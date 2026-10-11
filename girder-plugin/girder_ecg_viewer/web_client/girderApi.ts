/**
 * Byte-level file access against the Girder REST API. Girder's own
 * `restRequest` goes through jQuery, which has no good story for binary
 * bodies, so these use `fetch` with the session token instead.
 */

import { parseDicomEcg } from '../../../server/parseDicomEcg';
import { truncateRecord } from '../../../shared/wireFormat';
import type { EcgRecord } from '../../../shared/ecgTypes';
import { SNIFF_BYTES, findEcgSopClass, type EcgSopClassUid } from './sniff';

/** Same display window as the standalone backend (`server/index.ts`). */
export const DISPLAY_DURATION_SEC = 10;

export function downloadUrl(fileId: string, params: Record<string, string | number> = {}): string {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
  return `${girder.rest.getApiRoot()}/file/${encodeURIComponent(fileId)}/download${qs ? `?${qs}` : ''}`;
}

async function fetchBytes(
  fileId: string,
  params: Record<string, string | number>,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const token = girder.auth.getCurrentToken();
  const res = await fetch(downloadUrl(fileId, params), {
    headers: token ? { 'Girder-Token': token } : {},
    credentials: 'same-origin',
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} while downloading the file.`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Fetch only the head of a file and look for an ECG SOP Class UID. */
export async function sniffEcg(fileId: string, signal?: AbortSignal): Promise<EcgSopClassUid | null> {
  const head = await fetchBytes(fileId, { offset: 0, endByte: SNIFF_BYTES }, signal);
  return findEcgSopClass(head);
}

/** Download a whole DICOM ECG and parse it in the browser. */
export async function loadEcg(fileId: string, signal?: AbortSignal): Promise<EcgRecord> {
  const bytes = await fetchBytes(fileId, {}, signal);
  return truncateRecord(parseDicomEcg(bytes), DISPLAY_DURATION_SEC);
}
