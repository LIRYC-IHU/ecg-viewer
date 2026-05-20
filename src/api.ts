import type { EcgRecord } from './types';
import { decodeRecord } from '../shared/wireFormat';

export { decodeRecord } from '../shared/wireFormat';

export interface SampleInfo {
  id: string;
  file: string;
}

/** Base URL for API endpoints. Empty = same-origin (proxy in dev, normal in prod). */
let baseUrl = '';

export function configureApi(opts: { baseUrl?: string }): void {
  if (opts.baseUrl !== undefined) baseUrl = opts.baseUrl.replace(/\/$/, '');
}

export async function listSamples(): Promise<SampleInfo[]> {
  const res = await fetch(`${baseUrl}/api/samples`);
  if (!res.ok) throw new Error(`HTTP ${res.status} on /api/samples`);
  return res.json();
}

export async function loadSample(id: string): Promise<EcgRecord> {
  const res = await fetch(`${baseUrl}/api/samples/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Échantillon ${id} : ${await errorMessage(res)}`);
  return decodeRecord(await res.arrayBuffer());
}

export async function uploadDicom(file: File): Promise<EcgRecord> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${baseUrl}/api/parse`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(await errorMessage(res));
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
