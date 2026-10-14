import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { SourceCode } from '@padlownia/domain';
import { WorkerError, type DevConfig } from './config.js';

export const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
export type StoredSnapshot = { bucket: 'source-snapshots'; path: string; verified: boolean };
export interface SnapshotStore { put(source: SourceCode, bytes: Uint8Array): Promise<StoredSnapshot> }
export function objectPath(source: SourceCode, bytes: Uint8Array): string {
  if (!['padelhow', 'padeltrue'].includes(source)) throw new WorkerError('INVALID_SOURCE');
  return `${source}/${sha256(bytes)}.json`;
}

export class LocalSnapshotStore implements SnapshotStore {
  constructor(private readonly root: string) {}
  async put(source: SourceCode, bytes: Uint8Array): Promise<StoredSnapshot> {
    const path = objectPath(source, bytes);
    const full = resolve(this.root, 'source-snapshots', path);
    await mkdir(resolve(full, '..'), { recursive: true });
    try { await writeFile(full, bytes, { flag: 'wx', mode: 0o600 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw new WorkerError('STORAGE_WRITE_FAILED'); }
    if (sha256(await readFile(full)) !== sha256(bytes)) throw new WorkerError('STORAGE_HASH_MISMATCH');
    return { bucket: 'source-snapshots', path, verified: true };
  }
}

/** HTTP operations are bounded; only 429/5xx/network failures are retried. No source fetching or LLM calls. */
export async function boundedFetch(url: string, init: RequestInit, request: typeof fetch = fetch): Promise<Response> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await request(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(15_000) });
      if (result.status !== 429 && result.status < 500) return result;
      if (attempt === 2) throw new WorkerError('STORAGE_UNAVAILABLE');
      await result.body?.cancel();
    } catch (error) {
      if (error instanceof WorkerError || attempt === 2) throw new WorkerError('STORAGE_UNAVAILABLE');
    }
    await new Promise((done) => setTimeout(done, 100 * 2 ** attempt));
  }
  throw new WorkerError('STORAGE_UNAVAILABLE');
}

export class SupabaseSnapshotStore implements SnapshotStore {
  constructor(private readonly config: DevConfig, private readonly request: typeof fetch = fetch) {
    if (!config.storageKey) throw new WorkerError('STORAGE_CREDENTIALS_MISSING');
  }
  async put(source: SourceCode, bytes: Uint8Array): Promise<StoredSnapshot> {
    const path = objectPath(source, bytes);
    const bucket = 'source-snapshots';
    const base = `${this.config.apiUrl}/storage/v1`;
    const headers = { apikey: this.config.storageKey!, Authorization: `Bearer ${this.config.storageKey!}` };
    const bucketResponse = await boundedFetch(`${base}/bucket/${bucket}`, { headers }, this.request);
    if (!bucketResponse.ok) throw new WorkerError('STORAGE_ACCESS_DENIED');
    const info = await bucketResponse.json() as { public?: boolean };
    if (info.public !== false) throw new WorkerError('STORAGE_BUCKET_NOT_PRIVATE');
    const uploaded = await boundedFetch(`${base}/object/${bucket}/${path}`, {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json', 'x-upsert': 'false' }, body: Buffer.from(bytes),
    }, this.request);
    // Existing content-addressed objects are accepted only after reading and verifying exact bytes.
    if (!uploaded.ok && ![400, 409].includes(uploaded.status)) throw new WorkerError('STORAGE_WRITE_FAILED');
    const fetched = await boundedFetch(`${base}/object/authenticated/${bucket}/${path}`, { headers }, this.request);
    if (!fetched.ok || sha256(new Uint8Array(await fetched.arrayBuffer())) !== sha256(bytes)) throw new WorkerError('STORAGE_HASH_MISMATCH');
    return { bucket, path, verified: true };
  }
}
