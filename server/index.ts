import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import compress from '@fastify/compress';
import { parseDicomEcg } from './parseDicomEcg.ts';
import { encodeRecord, truncateRecord } from '../shared/wireFormat.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = path.join(__dirname, 'samples');
const MAX_DICOM_BYTES = 20 * 1024 * 1024;
const DISPLAY_DURATION_SEC = 10;

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
  bodyLimit: MAX_DICOM_BYTES,
});

await app.register(compress, { global: true, threshold: 1024 });
await app.register(multipart, {
  limits: { fileSize: MAX_DICOM_BYTES, files: 1 },
});

function recordToWire(rec: ReturnType<typeof parseDicomEcg>): Buffer {
  const truncated = truncateRecord(rec, DISPLAY_DURATION_SEC);
  const u8 = encodeRecord(truncated);
  return Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength);
}

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
  reply.header('content-type', 'application/octet-stream');
  return recordToWire(parseDicomEcg(new Uint8Array(buf)));
});

app.post('/api/parse', async (req, reply) => {
  const data = await req.file();
  if (!data) {
    return reply.code(400).send({ error: 'Aucun fichier reçu.' });
  }
  const buf = await data.toBuffer();
  try {
    reply.header('content-type', 'application/octet-stream');
    return recordToWire(parseDicomEcg(new Uint8Array(buf)));
  } catch (e) {
    req.log.warn({ err: e }, 'parse failed');
    return reply.code(400).send({
      error: e instanceof Error ? e.message : 'Parsing DICOM impossible.',
    });
  }
});

const port = Number(process.env.API_PORT ?? 3001);
await app.listen({ port, host: '127.0.0.1' });
