import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import compress from '@fastify/compress';
import { parseDicomEcg } from './parseDicomEcg.ts';
import type { EcgRecord, EcgRecordMetaWire } from '../shared/ecgTypes.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = path.join(__dirname, 'samples');
const MAX_DICOM_BYTES = 20 * 1024 * 1024;
const DISPLAY_DURATION_SEC = 10;

/** Clip every channel to the first N seconds. No-op if already shorter. */
function truncateRecord(record: EcgRecord, maxSeconds: number): EcgRecord {
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

/**
 * Wire format:
 *   uint32 LE        json length (already padded to mult. of 4)
 *   N bytes          UTF-8 JSON (EcgRecordMetaWire), space-padded to mult. of 4
 *   M × 4 bytes      Float32 LE samples, concatenated channel by channel
 */
function encodeRecord(record: EcgRecord): Buffer {
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

  let json = Buffer.from(JSON.stringify(meta), 'utf-8');
  const pad = (4 - (json.length % 4)) % 4;
  if (pad > 0) json = Buffer.concat([json, Buffer.alloc(pad, 0x20)]); // pad with spaces (valid JSON whitespace)

  const samplesBytes = record.channels.reduce(
    (sum, c) => sum + c.samples.byteLength,
    0,
  );
  const out = Buffer.alloc(4 + json.length + samplesBytes);
  out.writeUInt32LE(json.length, 0);
  json.copy(out, 4);
  let offset = 4 + json.length;
  for (const ch of record.channels) {
    const view = new Uint8Array(
      ch.samples.buffer,
      ch.samples.byteOffset,
      ch.samples.byteLength,
    );
    out.set(view, offset);
    offset += view.byteLength;
  }
  return out;
}

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
  bodyLimit: MAX_DICOM_BYTES,
});

await app.register(compress, { global: true, threshold: 1024 });
await app.register(multipart, {
  limits: { fileSize: MAX_DICOM_BYTES, files: 1 },
});

app.get('/api/health', async () => ({ ok: true }));

app.get('/api/samples', async () => {
  const files = await readdir(SAMPLES_DIR);
  return files
    .filter((f) => f.toLowerCase().endsWith('.dcm'))
    .sort()
    .map((f) => ({ id: path.basename(f, path.extname(f)), file: f }));
});

app.get<{ Params: { id: string } }>('/api/samples/:id', async (req, reply) => {
  const { id } = req.params;
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return reply.code(400).send({ error: 'Identifiant invalide.' });
  }
  const filePath = path.join(SAMPLES_DIR, `${id}.dcm`);
  let buf: Buffer;
  try {
    buf = await readFile(filePath);
  } catch {
    return reply.code(404).send({ error: 'Échantillon introuvable.' });
  }
  const record = truncateRecord(
    parseDicomEcg(new Uint8Array(buf)),
    DISPLAY_DURATION_SEC,
  );
  reply.header('content-type', 'application/octet-stream');
  return encodeRecord(record);
});

app.post('/api/parse', async (req, reply) => {
  const data = await req.file();
  if (!data) {
    return reply.code(400).send({ error: 'Aucun fichier reçu.' });
  }
  const buf = await data.toBuffer();
  try {
    const record = truncateRecord(
      parseDicomEcg(new Uint8Array(buf)),
      DISPLAY_DURATION_SEC,
    );
    reply.header('content-type', 'application/octet-stream');
    return encodeRecord(record);
  } catch (e) {
    req.log.warn({ err: e }, 'parse failed');
    return reply.code(400).send({
      error: e instanceof Error ? e.message : 'Parsing DICOM impossible.',
    });
  }
});

const port = Number(process.env.API_PORT ?? 3001);
await app.listen({ port, host: '127.0.0.1' });
