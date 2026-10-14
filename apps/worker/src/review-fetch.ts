import { WorkerError } from './config.js';
import { parseReviewDetail, type CatalogueLink } from './knowledge.js';
import { sha256 } from './storage.js';

export interface ReviewFetchProvenance { sourceUrl: string; fetchedAt: string; sha256: string; lastModified: string | null; etag: string | null }

/** Fetch only an exact catalogue-declared static detail URL; never crawl links or forward credentials. */
export async function fetchReviewDetail(record: CatalogueLink, request: typeof fetch = fetch): Promise<{ bytes: Uint8Array; provenance: ReviewFetchProvenance }> {
  const expected = 'https://padel.how/rackets/' + record.slug + '.json';
  if (!/^[a-z0-9-]+$/.test(record.slug) || record.jsonUrl !== expected) throw new WorkerError('REVIEW_FETCH_URL_REJECTED');
  const response = await request(expected, { redirect: 'error',signal: AbortSignal.timeout(15_000),headers: { accept: 'application/json' } });
  if (!response.ok) { await response.body?.cancel(); throw new WorkerError('REVIEW_FETCH_FAILED'); }
  if (!/application\/json/i.test(response.headers.get('content-type') ?? '')) { await response.body?.cancel(); throw new WorkerError('REVIEW_CONTENT_TYPE_INVALID'); }
  if (Number(response.headers.get('content-length')) > 2 * 1024 * 1024) { await response.body?.cancel(); throw new WorkerError('REVIEW_TOO_LARGE'); }
  const reader = response.body?.getReader();
  if (!reader) throw new WorkerError('REVIEW_BODY_MISSING');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 2 * 1024 * 1024) { await reader.cancel(); throw new WorkerError('REVIEW_TOO_LARGE'); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = Buffer.concat(chunks);
  parseReviewDetail(bytes,record);
  return { bytes,provenance: { sourceUrl: expected,fetchedAt: new Date().toISOString(),sha256: sha256(bytes),
    lastModified: response.headers.get('last-modified'),etag: response.headers.get('etag') } };
}
