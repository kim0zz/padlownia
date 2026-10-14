import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openLocalDatabase, readPublishedCatalogue, stageKnowledge, type StageKnowledgeInput, type SqlExecutor } from '@padlownia/database';

// Synthetic metadata only; no third-party articles, dataset or article body.
function input(overrides: Partial<StageKnowledgeInput> = {}): StageKnowledgeInput {
  const sha256 = 'a'.repeat(64);
  return { source: 'padelhow',sha256,bytes: 1000,parserVersion: 'synthetic-v1',format: 'text',retrievedAt: '2026-10-14T17:00:00Z',
    storage: { bucket: 'review-originals',path: `padelhow/${sha256}.txt`,verified: true },sourceMetadata: { synthetic: true,fileKind: 'test-corpus' },
    documents: [0,1].map(ordinal => ({ ordinal,sourcePath: `/synthetic-${ordinal}/index.md`,url: `https://padel.how/synthetic-${ordinal}/`,title: `Synthetic title ${ordinal}`,
      locale: 'en',kind: 'general',sha256: String(ordinal + 1).repeat(64),characterStart: ordinal * 400,characterEnd: ordinal * 400 + 350,productSlugs: [],issues: ['source_claims_unreviewed'] })),...overrides };
}
describe('private knowledge manifests (isolated PostgreSQL)', () => {
  let db: SqlExecutor;
  let close: () => Promise<void>;
  beforeEach(async () => { ({ db,close } = await openLocalDatabase()); });
  afterEach(async () => { await close?.(); });
  async function counts() {
    return (await db.query<{ assets: number; documents: number }>(`select
      (select count(*)::int from padlownia.knowledge_assets) assets,
      (select count(*)::int from padlownia.knowledge_documents) documents`)).rows[0];
  }
  it('atomically stages private metadata and replays exactly without accepting source rights', async () => {
    const first = await stageKnowledge(db,input());
    const replay = await stageKnowledge(db,input({ retrievedAt: '2026-10-15T17:00:00Z',sourceMetadata: { fileKind: 'test-corpus',synthetic: true } }));
    expect(first).toMatchObject({ documents: 2,replayed: false });
    expect(replay).toEqual({ ...first,replayed: true });
    expect(await counts()).toEqual({ assets: 1,documents: 2 });
    expect((await db.query<{ rights_state: string }>('select rights_state from padlownia.knowledge_assets')).rows[0]!.rights_state).toBe('private_staging_unreviewed');
    expect((await db.query<{ rights_status: string; catalogue_display_allowed: boolean }>("select rights_status,catalogue_display_allowed from padlownia.data_sources where code='padelhow'")).rows[0]).toEqual({ rights_status: 'pending',catalogue_display_allowed: false });
    expect(await readPublishedCatalogue(db)).toEqual([]);
    const columns = (await db.query<{ column_name: string }>("select column_name from information_schema.columns where table_schema='padlownia' and table_name in ('knowledge_assets','knowledge_documents')")).rows.map(row => row.column_name);
    expect(columns).not.toEqual(expect.arrayContaining(['text','body','chunks','embedding']));
  });
  it('rejects changed metadata under the same parser version, but preserves an explicit parser revision', async () => {
    const first = await stageKnowledge(db,input());
    const changed = input();
    changed.documents[0]!.url = 'https://padel.how/corrected-source/';
    await expect(stageKnowledge(db,changed)).rejects.toThrow('KNOWLEDGE_REPLAY_MISMATCH');
    const revised = await stageKnowledge(db,{ ...changed,parserVersion: 'synthetic-v2' });
    expect(revised.assetId).not.toBe(first.assetId);
    expect(await counts()).toEqual({ assets: 2,documents: 4 });
    expect((await db.query<{ storage_path: string }>('select distinct storage_path from padlownia.knowledge_assets')).rows).toHaveLength(1);
  });
  it('rolls back the entire manifest after a database failure without disclosing the driver error', async () => {
    const failing: SqlExecutor = { ...db,transaction: work => db.transaction(tx => work({ ...tx,query: async <T>(sql: string,params?: unknown[]) => {
      const result = await tx.query<T>(sql,params);
      if (sql.includes('insert into padlownia.knowledge_documents')) throw new Error('password=do-not-print');
      return result;
    } })) };
    await expect(stageKnowledge(failing,input())).rejects.toThrow(/^KNOWLEDGE_STAGE_FAILED$/);
    expect(await counts()).toEqual({ assets: 0,documents: 0 });
    expect((await stageKnowledge(db,input())).replayed).toBe(false);
  });
  it('rejects malformed hashes, storage pointers, incomplete or overlapping document indices before writes', async () => {
    for (const malformed of [
      input({ sha256: 'bad' }),input({ bytes: 10 }),input({ documents: [] }),
      input({ storage: { bucket: 'review-originals',path: 'padelhow/other.txt',verified: true } }),
      input({ storage: { bucket: 'review-originals',path: `padelhow/${'a'.repeat(64)}.txt`,verified: false } }),
    ]) await expect(stageKnowledge(db,malformed)).rejects.toThrow('KNOWLEDGE_MANIFEST_INVALID');
    for (const patch of [{ ordinal: 2 },{ characterStart: 349 },{ sha256: 'bad' },{ url: 'https://outside.example/article' },{ text: 'Never persist original text' }]) {
      const malformed = input();
      Object.assign(malformed.documents[1]!,patch);
      await expect(stageKnowledge(db,malformed)).rejects.toThrow('KNOWLEDGE_MANIFEST_INVALID');
    }
    expect(await counts()).toEqual({ assets: 0,documents: 0 });
  });
  it('enforces complete manifests at commit even for direct SQL', async () => {
    await expect(db.transaction(async tx => {
      await tx.query(`insert into padlownia.knowledge_assets(source_code,sha256,byte_count,parser_version,format,retrieved_at,storage_bucket,storage_path,storage_verified,document_count,manifest_sha256)
        values('padelhow',$1,1000,'synthetic-v1','text',now(),'review-originals',$2,true,2,$1)`, ['a'.repeat(64),`padelhow/${'a'.repeat(64)}.txt`]);
    })).rejects.toThrow('INCOMPLETE_KNOWLEDGE_MANIFEST');
    expect(await counts()).toEqual({ assets: 0,documents: 0 });
  });
  it('keeps manifests immutable and rejects documents appended outside original ordinal bounds', async () => {
    const staged = await stageKnowledge(db,input());
    for (const sql of ['update padlownia.knowledge_assets set source_metadata=\'{}\'', 'delete from padlownia.knowledge_assets', 'update padlownia.knowledge_documents set title=\'changed\'', 'delete from padlownia.knowledge_documents']) {
      await expect(db.query(sql)).rejects.toThrow('IMMUTABLE_HISTORY');
    }
    await expect(db.query(`insert into padlownia.knowledge_documents(asset_id,ordinal,title,kind,sha256,character_start,character_end)
      values($1,2,'Extra','general',$2,800,900)`, [staged.assetId,'b'.repeat(64)])).rejects.toThrow('INVALID_KNOWLEDGE_DOCUMENT_BOUNDS');
  });
  it('allows worker insert/select but denies raw manifest access to every browser/reader role and worker mutation', async () => {
    await db.transaction(async tx => {
      await tx.query('set local role padlownia_worker');
      expect((await stageKnowledge(tx,input())).documents).toBe(2);
      expect((await tx.query('select * from padlownia.knowledge_documents')).rows).toHaveLength(2);
    });
    for (const role of ['anon','authenticated','padlownia_reader','padlownia_web']) {
      for (const table of ['knowledge_assets','knowledge_documents']) await expect(db.transaction(async tx => {
        await tx.query(`set local role ${role}`);
        await tx.query(`select * from padlownia.${table}`);
      })).rejects.toThrow(/permission denied/);
    }
    for (const sql of ["update padlownia.knowledge_assets set rights_state='private_staging_unreviewed'",'delete from padlownia.knowledge_documents']) await expect(db.transaction(async tx => {
      await tx.query('set local role padlownia_worker');
      await tx.query(sql);
    })).rejects.toThrow(/permission denied/);
    expect((await db.query<{ protected: number }>("select count(*)::int protected from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='padlownia' and c.relname in ('knowledge_assets','knowledge_documents') and c.relrowsecurity")).rows[0]!.protected).toBe(2);
  });
});
