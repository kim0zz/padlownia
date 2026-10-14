import { createHash } from 'node:crypto';
import type { Json } from '@padlownia/domain';
import type { SqlExecutor } from './executor.js';

/** Metadata only. The original article text remains in private Storage. */
export interface KnowledgeDocumentManifest {
  ordinal: number; sourcePath: string | null; url: string | null; title: string; locale: string | null;
  kind: string; sha256: string; characterStart: number; characterEnd: number;
  productSlugs: string[]; issues: string[];
}
export interface StageKnowledgeInput {
  source: 'padelhow'; sha256: string; bytes: number; parserVersion: string; format: 'text' | 'json'; retrievedAt: string;
  storage: { bucket: 'review-originals'; path: string; verified: boolean };
  sourceMetadata: Record<string, Json>; documents: KnowledgeDocumentManifest[];
}
export interface StageKnowledgeResult { assetId: string; documents: number; replayed: boolean }
export class KnowledgeStageError extends Error {
  constructor(public readonly code: string) { super(code); this.name = 'KnowledgeStageError'; }
}
const invalid = (): never => { throw new KnowledgeStageError('KNOWLEDGE_MANIFEST_INVALID'); };
const hashPattern = /^[a-f0-9]{64}$/;
const boundedText = (value: unknown, maximum: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= maximum && !value.includes('\0');
const safeUrl = (value: string): boolean => {
  try { const url = new URL(value); return url.origin === 'https://padel.how' && !url.username && !url.password && !url.search && !url.hash && value === url.href; }
  catch { return false; }
};
function canonical(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object' && value && [Object.prototype,null].includes(Object.getPrototypeOf(value))) {
    return `{${Object.entries(value).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([key,item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  return invalid();
}
function validate(input: StageKnowledgeInput): string {
  if (input.source !== 'padelhow' || !hashPattern.test(input.sha256) || !Number.isInteger(input.bytes) || input.bytes < 1 || input.bytes > 50 * 1024 * 1024
    || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(input.parserVersion) || !['text','json'].includes(input.format)
    || !Number.isFinite(Date.parse(input.retrievedAt)) || input.storage.bucket !== 'review-originals' || input.storage.verified !== true
    || input.storage.path !== `${input.source}/${input.sha256}.${input.format === 'text' ? 'txt' : 'json'}`
    || !input.sourceMetadata || Array.isArray(input.sourceMetadata) || !Array.isArray(input.documents) || !input.documents.length || input.documents.length > 50000) invalid();
  let previousEnd = 0;
  for (const [index, doc] of input.documents.entries()) {
    if ('text' in doc || doc.ordinal !== index || !hashPattern.test(doc.sha256)
      || !Number.isInteger(doc.characterStart) || !Number.isInteger(doc.characterEnd) || doc.characterStart < previousEnd || doc.characterEnd <= doc.characterStart || doc.characterEnd > input.bytes
      || !boundedText(doc.title,2048) || (doc.sourcePath !== null && !boundedText(doc.sourcePath,4096))
      || (doc.url !== null && (!boundedText(doc.url,2048) || !safeUrl(doc.url)))
      || (doc.locale !== null && (!boundedText(doc.locale,35) || !/^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$/.test(doc.locale)))
      || !/^[a-z][a-z0-9_]{0,63}$/.test(doc.kind)
      || !Array.isArray(doc.productSlugs) || doc.productSlugs.length > 100 || doc.productSlugs.some(slug => typeof slug !== 'string' || !/^[a-z0-9-]{1,300}$/.test(slug))
      || !Array.isArray(doc.issues) || doc.issues.length > 100 || doc.issues.some(issue => typeof issue !== 'string' || !/^[a-z0-9_]{1,100}$/.test(issue))) invalid();
    previousEnd = doc.characterEnd;
  }
  if (Buffer.byteLength(canonical(input.sourceMetadata)) > 60000) invalid();
  // Retrieval timestamps describe the first archived copy; repeat reads preserve that timestamp.
  return createHash('sha256').update(canonical({ source: input.source,sha256: input.sha256,bytes: input.bytes,parserVersion: input.parserVersion,
    format: input.format,storage: input.storage,sourceMetadata: input.sourceMetadata,documents: input.documents })).digest('hex');
}

/** Atomic metadata staging; never changes rights, catalogue publication or canonical claims. */
export async function stageKnowledge(db: SqlExecutor, input: StageKnowledgeInput): Promise<StageKnowledgeResult> {
  let manifestHash: string;
  try { manifestHash = validate(input); }
  catch (error) { if (error instanceof KnowledgeStageError) throw error; throw new KnowledgeStageError('KNOWLEDGE_MANIFEST_INVALID'); }
  try {
    return await db.transaction(async tx => {
      const inserted = (await tx.query<{ id: string }>(`insert into padlownia.knowledge_assets
        (source_code,sha256,byte_count,parser_version,format,retrieved_at,storage_bucket,storage_path,storage_verified,source_metadata,document_count,manifest_sha256)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12)
        on conflict(source_code,sha256,parser_version) do nothing returning id`,
      [input.source,input.sha256,input.bytes,input.parserVersion,input.format,input.retrievedAt,input.storage.bucket,input.storage.path,input.storage.verified,JSON.stringify(input.sourceMetadata),input.documents.length,manifestHash])).rows[0];
      if (!inserted) {
        const existing = (await tx.query<{ id: string; manifest_sha256: string; document_count: number }>(
          'select id,manifest_sha256,document_count from padlownia.knowledge_assets where source_code=$1 and sha256=$2 and parser_version=$3',
          [input.source,input.sha256,input.parserVersion])).rows[0];
        if (!existing || existing.manifest_sha256 !== manifestHash || existing.document_count !== input.documents.length) throw new KnowledgeStageError('KNOWLEDGE_REPLAY_MISMATCH');
        return { assetId: existing.id,documents: existing.document_count,replayed: true };
      }
      // Whitelist fields explicitly: JavaScript callers cannot accidentally persist article bodies.
      const rows = input.documents.map(doc => ({ ordinal: doc.ordinal,source_path: doc.sourcePath,url: doc.url,title: doc.title,locale: doc.locale,kind: doc.kind,
        sha256: doc.sha256,character_start: doc.characterStart,character_end: doc.characterEnd,product_slugs: doc.productSlugs,issues: doc.issues }));
      await tx.query(`insert into padlownia.knowledge_documents
        (asset_id,ordinal,source_path,url,title,locale,kind,sha256,character_start,character_end,product_slugs,issues)
        select $1,ordinal,source_path,url,title,locale,kind,sha256,character_start,character_end,product_slugs,issues from jsonb_to_recordset($2::jsonb)
        as doc(ordinal integer,source_path text,url text,title text,locale text,kind text,sha256 text,character_start integer,character_end integer,product_slugs text[],issues text[])`, [inserted.id,JSON.stringify(rows)]);
      return { assetId: inserted.id,documents: rows.length,replayed: false };
    });
  } catch (error) {
    if (error instanceof KnowledgeStageError) throw error;
    throw new KnowledgeStageError('KNOWLEDGE_STAGE_FAILED');
  }
}
