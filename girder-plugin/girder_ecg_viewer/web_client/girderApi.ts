/**
 * Calls to the plugin's REST endpoints. Girder's own `restRequest` goes
 * through jQuery, which has no good story for binary bodies, so these use
 * `fetch` with the session token instead.
 */

import { parseDicomEcg } from '../../../server/parseDicomEcg';
import { truncateRecord } from '../../../shared/wireFormat';
import type { EcgRecord } from '../../../shared/ecgTypes';

/** Same display window as the standalone backend (`server/index.ts`). */
export const DISPLAY_DURATION_SEC = 10;

/** An entry of `GET /item/{id}/ecg`. */
export interface EcgFile {
  _id: string;
  name: string;
  size: number;
  /** `dicom`, `fda`, `philips`, `muse`, `nk`, `fukuda`, `mindray`. */
  format: string;
  formatLabel: string;
  /** True when the server converts the file to DICOM with ecg-bridge. */
  converted: boolean;
  /** Formats the file can be downloaded as (`dicom`, `fda`). */
  exports: ExportFormat[];
}

export type ExportFormat = 'dicom' | 'fda';

export const EXPORT_LABELS: Record<ExportFormat, string> = {
  dicom: 'DICOM (.dcm)',
  fda: 'FDA HL7 aECG (.xml)',
};

function apiUrl(path: string): string {
  return `${girder.rest.getApiRoot()}/${path}`;
}

/** Plain download of the original file (for the download button). */
export function downloadUrl(fileId: string): string {
  return apiUrl(`file/${encodeURIComponent(fileId)}/download`);
}

/** Download as DICOM or FDA aECG XML, converted server-side if needed. */
export function exportUrl(fileId: string, format: ExportFormat): string {
  return apiUrl(`file/${encodeURIComponent(fileId)}/ecg/download?format=${format}`);
}

async function get(path: string, signal?: AbortSignal): Promise<Response> {
  const token = girder.auth.getCurrentToken();
  const res = await fetch(apiUrl(path), {
    headers: token ? { 'Girder-Token': token } : {},
    credentials: 'same-origin',
    signal,
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      message = (await res.json()).message ?? message;
    } catch {
      // Not a Girder JSON error: keep the status.
    }
    throw new Error(message);
  }
  return res;
}

/** The item's files that the server can hand over as a DICOM ECG. */
export async function listItemEcgFiles(itemId: string, signal?: AbortSignal): Promise<EcgFile[]> {
  const res = await get(`item/${encodeURIComponent(itemId)}/ecg`, signal);
  return res.json();
}

/** Fetch a file as DICOM (converted server-side if needed) and parse it. */
export async function loadEcg(fileId: string, signal?: AbortSignal): Promise<EcgRecord> {
  const res = await get(`file/${encodeURIComponent(fileId)}/ecg`, signal);
  const bytes = new Uint8Array(await res.arrayBuffer());
  return truncateRecord(parseDicomEcg(bytes), DISPLAY_DURATION_SEC);
}
