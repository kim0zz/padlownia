import { createHash } from 'node:crypto';
import { WorkerError } from './config.js';

export const KNOWLEDGE_PARSER_VERSION = 'knowledge-v1';
const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : {};
export interface CatalogueLink { slug: string; url: string; jsonUrl: string | null; brand: string; year: number | null }
export interface KnowledgeDocument {
  ordinal: number; sourcePath: string | null; url: string | null; title: string; locale: string | null;
  kind: string; sha256: string; characterStart: number; characterEnd: number;
  productSlugs: string[]; issues: string[]; text: string;
}
export interface KnowledgeCorpus {
  sha256: string; bytes: number; parserVersion: string; format: 'text' | 'json';
  documents: KnowledgeDocument[]; issues: string[];
}

/** Exact source URLs identify a review; article mentions never identify its subject. */
export function catalogueLinks(bytes: Uint8Array): CatalogueLink[] {
  let root: ObjectValue;
  try { root = object(JSON.parse(Buffer.from(bytes).toString('utf8'))); } catch { throw new WorkerError('CATALOGUE_JSON_INVALID'); }
  if (root.category !== 'rackets' || !Array.isArray(root.rackets)) throw new WorkerError('PADELHOW_CATALOGUE_REQUIRED');
  const slugs = new Set<string>(), urls = new Set<string>();
  return root.rackets.map(value => {
    const row = object(value);
    if (typeof row.slug !== 'string' || !/^[a-z0-9-]+$/.test(row.slug) || typeof row.url !== 'string') throw new WorkerError('CATALOGUE_LINK_INVALID');
    const url = safeSourceUrl(row.url);
    if (url !== `https://padel.how/equipment/racket/${row.slug}/` || slugs.has(row.slug) || urls.has(url)) throw new WorkerError('CATALOGUE_LINK_INVALID');
    const jsonUrl = typeof row.json_url === 'string' ? safeSourceUrl(row.json_url) : null;
    if (row.json_url != null && jsonUrl !== `https://padel.how/rackets/${row.slug}.json`) throw new WorkerError('CATALOGUE_LINK_INVALID');
    slugs.add(row.slug); urls.add(url);
    return { slug: row.slug, url, jsonUrl,
      brand: typeof row.brand === 'string' ? row.brand : '', year: Number.isInteger(row.year) ? row.year as number : null };
  });
}
export function safeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.origin !== 'https://padel.how' || url.username || url.password || url.search || url.hash || /%|\\|\/\.\.?(?:\/|$)/.test(value)) return null;
    return url.href;
  } catch { return null; }
}
function markerUrl(path: string): string | null {
  if (!/^\/(?:[a-z0-9_-]+\/)*index\.md$/.test(path)) return null;
  return 'https://padel.how' + path.slice(0, -'index.md'.length);
}
function metadata(text: string): ObjectValue {
  const match = text.match(/^\s*---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const result: ObjectValue = Object.create(null);
  for (const line of match?.[1]?.split(/\r?\n/) ?? []) {
    const pair = line.match(/^([a-zA-Z_-]+):\s*(.*?)\s*$/);
    if (!pair || !['title', 'url', 'locale'].includes(pair[1]!)) continue;
    let value = pair[2]!;
    if (value.startsWith('"') && value.endsWith('"')) { try { value = JSON.parse(value) as string; } catch { value = value.slice(1,-1); } }
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1,-1);
    result[pair[1]!] = value;
  }
  return result;
}
function kindOf(url: string | null, products: string[]): string {
  if (products.length) return 'racket_review';
  const path = url ? new URL(url).pathname : '';
  if (/copyright|privacy|terms/.test(path)) return 'rights';
  if (/\/equipment\/racket\/methodology\//.test(path)) return 'racket_methodology';
  if (/\/equipment\/racket\//.test(path)) return 'racket_guide';
  if (/\/equipment\//.test(path)) return 'other_equipment';
  if (/^\/(?:api\/|llms)/.test(path)) return 'discovery';
  return 'general';
}
export function parseKnowledge(bytes: Uint8Array, catalogue: CatalogueLink[]): KnowledgeCorpus {
  if (bytes.byteLength > 50 * 1024 * 1024) throw new WorkerError('KNOWLEDGE_TOO_LARGE');
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const corpus: KnowledgeCorpus = { sha256: digest(bytes), bytes: bytes.byteLength, parserVersion: KNOWLEDGE_PARSER_VERSION, format: 'text', documents: [], issues: [] };
  const markers = [...source.matchAll(/^<!-- source: ([^\r\n]+) -->\r?$/gm)];
  if (!markers.length) {
    if (!/^# padel\.how\b/.test(source)) throw new WorkerError('KNOWLEDGE_FORMAT_UNSUPPORTED');
    corpus.documents.push({ ordinal: 0,sourcePath: null,url: 'https://padel.how/llms.txt',title: 'padel.how discovery index',locale: null,kind: 'discovery',
      sha256: digest(source),characterStart: 0,characterEnd: source.length,productSlugs: [],issues: ['supplied_discovery_index_not_fact_evidence'],text: source });
    return corpus;
  }
  for (const [index, marker] of markers.entries()) {
    const start = marker.index! + marker[0].length;
    const end = markers[index+1]?.index ?? source.length;
    const text = source.slice(start,end), meta = metadata(text), path = marker[1]!;
    const derivedUrl = markerUrl(path);
    const declaredUrl = typeof meta.url === 'string' ? safeSourceUrl(meta.url) : null;
    const issues: string[] = [];
    if (!derivedUrl) issues.push('unsafe_source_marker');
    if (!meta.url) issues.push('url_derived_from_source_marker');
    else if (!declaredUrl) issues.push('unsafe_declared_url');
    else if (declaredUrl !== derivedUrl) issues.push('canonical_url_differs_from_marker');
    const url = declaredUrl ?? (meta.url ? null : derivedUrl);
    const products = derivedUrl && declaredUrl === derivedUrl ? catalogue.filter(r => r.url === url).map(r => r.slug) : [];
    corpus.documents.push({ ordinal: index,sourcePath: path,url,title: typeof meta.title === 'string' ? meta.title : text.match(/^# (.+)$/m)?.[1]?.trim() ?? path,
      locale: typeof meta.locale === 'string' ? meta.locale : null,kind: kindOf(url,products),sha256: digest(text),characterStart: start,characterEnd: end,productSlugs: products,issues,text });
  }
  for (const doc of corpus.documents) {
    if (doc.url && corpus.documents.filter(other => other.url === doc.url).length > 1) doc.issues.push('duplicate_canonical_url');
  }
  return corpus;
}

export function parseReviewDetail(bytes: Uint8Array, expected: CatalogueLink): KnowledgeCorpus {
  let row: ObjectValue;
  try { row = object(JSON.parse(Buffer.from(bytes).toString('utf8'))); } catch { throw new WorkerError('REVIEW_JSON_INVALID'); }
  if (row.slug !== expected.slug || row.url !== expected.url || row.year !== expected.year
    || typeof row.brand !== 'string' || row.brand.trim().toLowerCase() !== expected.brand.trim().toLowerCase()) throw new WorkerError('REVIEW_IDENTITY_MISMATCH');
  const text = Buffer.from(bytes).toString('utf8');
  return { sha256: digest(bytes),bytes: bytes.byteLength,parserVersion: KNOWLEDGE_PARSER_VERSION,format: 'json',issues: [],
    documents: [{ ordinal: 0,sourcePath: null,url: expected.url,title: typeof row.name === 'string' ? row.name : expected.slug,locale: null,kind: 'racket_review_detail',
      sha256: digest(text),characterStart: 0,characterEnd: text.length,productSlugs: [expected.slug],issues: ['source_claims_unreviewed'],text }] };
}
export function knowledgeSummary(corpus: KnowledgeCorpus) {
  const kinds: Record<string, number> = Object.create(null), issues: Record<string, number> = Object.create(null);
  for (const doc of corpus.documents) {
    kinds[doc.kind] = (kinds[doc.kind] ?? 0) + 1;
    for (const issue of doc.issues) issues[issue] = (issues[issue] ?? 0) + 1;
  }
  return { sha256: corpus.sha256,bytes: corpus.bytes,parserVersion: corpus.parserVersion,documents: corpus.documents.length,
    exactLinkedProducts: new Set(corpus.documents.flatMap(d => d.productSlugs)).size,kinds,issues,publicationState: 'private_unreviewed',paidLlmCalls: 0 };
}
const tokens = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter(t => t.length > 2) ?? [];
/** Offline audit search, never a runtime AI retriever or an endorsement of source instructions. */
export function searchKnowledge(corpus: KnowledgeCorpus, query: string, options: { slug?: string; limit?: number } = {}) {
  const queryTokens = [...new Set(tokens(query))];
  if (!queryTokens.length || query.length > 300) throw new WorkerError('KNOWLEDGE_QUERY_INVALID');
  const limit = options.limit ?? 5;
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new WorkerError('KNOWLEDGE_LIMIT_INVALID');
  const candidates: { doc: KnowledgeDocument; text: string; score: number; fingerprint: string }[] = [];
  for (const doc of corpus.documents) {
    if (options.slug && !doc.productSlugs.includes(options.slug)) continue;
    if (doc.issues.some(i => i.startsWith('unsafe_'))) continue;
    const body = doc.text.replace(/^\s*---\r?\n[\s\S]*?\r?\n---/, '').replace(/<script\b[\s\S]*?<\/script>/gi, '');
    for (const paragraph of body.split(/\r?\n\s*\r?\n/)) {
      const text = paragraph.replace(/\s+/g,' ').trim();
      if (text.length < 50) continue;
      const words = tokens(text), found = queryTokens.filter(token => words.includes(token));
      if (!found.length) continue;
      const score = found.length / queryTokens.length + found.reduce((sum,token) => sum + Math.min(words.filter(w => w === token).length,3),0) / (10 + words.length);
      // Retrieval tokenization may drop short words/numbers. Deduplication must
      // preserve them or distinct measured values and variant names disappear.
      candidates.push({ doc,text,score,fingerprint: digest(text) });
    }
  }
  candidates.sort((a,b) => b.score-a.score || a.doc.ordinal-b.doc.ordinal);
  const selected = candidates.filter((item,index) => candidates.findIndex(other => other.fingerprint === item.fingerprint) === index).slice(0,limit);
  return selected.map(({ doc,text,score,fingerprint }) => ({ title: doc.title,url: doc.url,sourcePath: doc.sourcePath,documentSha256: doc.sha256,corpusSha256: corpus.sha256,
    productSlugs: doc.productSlugs,kind: doc.kind,issues: doc.issues,score,snippet: text.slice(0,600),occurrences: candidates.filter(c => c.fingerprint === fingerprint).length,
    status: 'private_unreviewed_source_excerpt' }));
}
