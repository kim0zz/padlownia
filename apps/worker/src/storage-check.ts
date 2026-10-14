import { randomUUID } from 'node:crypto';
import { assertDevelopmentDatabase, type SqlExecutor } from '@padlownia/database/executor';
import { WorkerError, type DevConfig } from './config.js';
import { boundedFetch, objectPath, originalPath, storageAuthHeaders, SupabaseSnapshotStore, type OriginalFormat } from './storage.js';

function anonymousHeaders(key: string | undefined): Record<string, string> | undefined {
  if (!key) return undefined;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return { apikey: key };
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1]!, 'base64url').toString('utf8')) as { role?: string };
    if (payload.role === 'anon' && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) return { apikey: key, Authorization: `Bearer ${key}` };
  } catch { /* Reject malformed keys without revealing their value. */ }
  throw new WorkerError('STORAGE_PROBE_ANONYMOUS_KEY_INVALID');
}

/** Explicit Dev-only operational check. Creates and deletes only its own unique synthetic object. */
export async function checkDevelopmentStorage(config: DevConfig, db: SqlExecutor, publishableKey?: string, request: typeof fetch = fetch, originalFormat?: OriginalFormat) {
  await assertDevelopmentDatabase(db, config.projectRef);
  const headers = storageAuthHeaders(config.storageKey);
  const anonymous = anonymousHeaders(publishableKey);
  const bytes = Buffer.from(JSON.stringify({ synthetic: true, purpose: 'padlownia-dev-storage-check', nonce: randomUUID() }));
  const bucket = originalFormat ? 'review-originals' : 'source-snapshots';
  const path = originalFormat ? originalPath('padelhow', bytes, originalFormat) : objectPath('padelhow', bytes);
  const base = `${config.apiUrl}/storage/v1`;
  const authenticatedUrl = `${base}/object/authenticated/${bucket}/${path}`;
  let attemptedWrite = false;
  const store = new SupabaseSnapshotStore(config, async (url, init) => {
    if (init?.method === 'POST') attemptedWrite = true;
    return request(url, init);
  });
  const denyRead = async (url: string, accessHeaders?: Record<string, string>): Promise<number> => {
    const response = await boundedFetch(url, { headers: accessHeaders }, request);
    await response.body?.cancel();
    if (![400, 401, 403, 404].includes(response.status)) throw new WorkerError('STORAGE_PROBE_ACCESS_NOT_DENIED');
    return response.status;
  };
  const cleanup = async (): Promise<void> => {
    if (!attemptedWrite) return;
    const deleted = await boundedFetch(`${base}/object/${bucket}`, {
      method: 'DELETE', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ prefixes: [path] }),
    }, request);
    await deleted.body?.cancel();
    if (!deleted.ok) throw new WorkerError('STORAGE_PROBE_CLEANUP_FAILED');
    const absent = await boundedFetch(authenticatedUrl, { headers }, request);
    await absent.body?.cancel();
    if (![400, 404].includes(absent.status)) throw new WorkerError('STORAGE_PROBE_CLEANUP_NOT_VERIFIED');
  };
  try {
    const first = originalFormat ? await store.putOriginal('padelhow', bytes, originalFormat) : await store.put('padelhow', bytes);
    const replay = originalFormat ? await store.putOriginal('padelhow', bytes, originalFormat) : await store.put('padelhow', bytes);
    if (first.path !== replay.path || !first.verified || !replay.verified) throw new WorkerError('STORAGE_PROBE_REPLAY_FAILED');
    const noKeyReadStatus = await denyRead(authenticatedUrl);
    const noKeyPublicReadStatus = await denyRead(`${base}/object/public/${bucket}/${path}`);
    const anonymousReadStatus = anonymous ? await denyRead(authenticatedUrl, anonymous) : null;
    return { projectRef: config.projectRef, bucket, path, uploadVerified: true, replayVerified: true, noKeyReadStatus, noKeyPublicReadStatus, anonymousReadStatus, anonymousCheck: anonymous ? 'passed' : 'skipped-no-publishable-key', cleanupVerified: true };
  } finally {
    await cleanup();
  }
}
