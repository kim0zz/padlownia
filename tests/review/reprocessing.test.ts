import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { normalizeRecord, type NormalizedRecord } from '@padlownia/domain';
import { approveRelease, openLocalDatabase, publishRelease, readPublishedCatalogue, rollbackRelease, setSourcePermission, stageImport, type SqlExecutor, type StageImportInput } from '@padlownia/database';

it('uses corrected parser provenance after retrying an initially invalid raw record', async () => {
  const { db, close } = await openLocalDatabase();
  try {
    await setSourcePermission(db, 'padeltrue', { reference: 'Authored synthetic fixture', scope: { synthetic: true } });
    const raw = { id: 'synthetic-source-id', brand: 'Example', name: 'Racket', year: '2026', url: 'https://example.test/synthetic-racket', specs: { shape: 'round' } };
    const sha256 = createHash('sha256').update(JSON.stringify(raw)).digest('hex');
    const input: StageImportInput = {
      source: 'padeltrue', sha256, retrievedAt: '2026-10-13T10:00:00Z',
      storage: { bucket: 'source-snapshots', path: `padeltrue/${sha256}.json`, verified: true },
      parserVersion: 'synthetic-1', normalizerVersion: 'synthetic-1', declaredCount: 1, actualCount: 1,
      records: [], recordErrors: [{ inputIndex: 0, externalId: 'snapshot-row:0', rawPayload: raw, issues: [{ code: 'invalid_year', path: '/year', severity: 'error' }] }],
    };
    await stageImport(db, input);
    // A versioned parser correction accepts this source's explicit string year.
    const fixed = normalizeRecord({
      contractVersion: '1.0.0', source: 'padeltrue', inputIndex: 0,
      externalId: raw.id, externalIdScope: 'source', sourceUrl: raw.url,
      identity: { brand: raw.brand, name: raw.name, year: 2026 },
      observations: [{ key: 'shape', rawValue: 'round', rawSourcePath: '/specs/shape', kind: 'unknown', context: {}, attribution: null }],
      ratings: [], metadata: {}, rawPayload: raw, issues: [],
    });
    const corrected = await stageImport(db, { ...input, parserVersion: 'synthetic-2', recordErrors: [], records: [fixed] });
    expect(corrected.gate.allowed).toBe(true);
    await approveRelease(db, corrected.releaseId, { actor: 'test', note: 'Reviewed synthetic correction' });
    await publishRelease(db, corrected.releaseId, { actor: 'test', expectedPreviousReleaseId: null });
    expect((await readPublishedCatalogue(db))[0]!.specs[0]!.evidence.sourceUrl).toBe(raw.url);
    expect((await db.query('select external_id,external_id_scope,source_url from padlownia.record_results where run_id=$1', [corrected.runId])).rows[0]).toEqual({ external_id: raw.id, external_id_scope: 'source', source_url: raw.url });
    expect((await db.query('select external_id,source_url,raw_payload from padlownia.source_records')).rows).toEqual([{ external_id: 'snapshot-row:0', source_url: null, raw_payload: raw }]);
  } finally { await close(); }
});

function validRecord(index = 0): NormalizedRecord {
  return normalizeRecord({
    contractVersion: '1.0.0', source: 'padeltrue', inputIndex: index,
    externalId: `synthetic-${index}`, externalIdScope: 'source', sourceUrl: `https://example.test/old/${index}`,
    identity: { brand: 'Example', name: `Racket ${index}`, year: 2026 },
    observations: [{ key: 'shape', rawValue: 'round', rawSourcePath: '/specs/shape', kind: 'unknown', context: {}, attribution: null }],
    ratings: [{ key: 'power', rawValue: 80, rawSourcePath: '/scores/power', numericScore: 80, scaleMin: 0, scaleMax: 100, methodology: 'synthetic', kind: 'rule_derived', status: 'valid', issues: [] }],
    metadata: {}, rawPayload: { id: `synthetic-${index}`, oldUrl: `https://example.test/old/${index}`, url: `https://example.test/new/${index}`, shape: 'round', power: 80 }, issues: [],
  });
}
function stagedInput(records: NormalizedRecord[], parserVersion: string): StageImportInput {
  const sha256 = createHash('sha256').update(JSON.stringify(records.map((r) => r.rawPayload))).digest('hex');
  return { source: 'padeltrue', sha256, retrievedAt: '2026-10-13T10:00:00Z', storage: { bucket: 'source-snapshots', path: `padeltrue/${sha256}.json`, verified: true }, parserVersion, normalizerVersion: 'synthetic-1', declaredCount: records.length, actualCount: records.length, records, recordErrors: [] };
}
// Simulate pre-migration results without rewriting history or disabling triggers.
function legacyWriter(db: SqlExecutor): SqlExecutor {
  return {
    query: async <T>(sql: string, params: unknown[] = []) => {
      if (sql.startsWith('insert into padlownia.record_results')) return db.query<T>('insert into padlownia.record_results(run_id,source_record_id,snapshot_id,status,issues) values($1,$2,$3,$4,$5::jsonb) returning id', params.slice(0, 5));
      return db.query<T>(sql, params);
    },
    transaction: (work) => db.transaction((tx) => work(legacyWriter(tx))),
  };
}

it('preserves legacy published provenance, fingerprints corrections and rolls back to the old interpretation', async () => {
  const { db, close } = await openLocalDatabase();
  try {
    await setSourcePermission(db, 'padeltrue', { reference: 'Authored synthetic fixture', scope: { synthetic: true } });
    const original = validRecord();
    const legacy = await stageImport(legacyWriter(db), stagedInput([original], 'legacy-parser'));
    await approveRelease(db, legacy.releaseId, { actor: 'test', note: 'Synthetic legacy interpretation' });
    await publishRelease(db, legacy.releaseId, { actor: 'test', expectedPreviousReleaseId: null });
    const corrected = await stageImport(db, stagedInput([{ ...original, externalId: 'corrected-source-id', sourceUrl: 'https://example.test/new/0' }], 'new-parser'));
    expect(corrected.gate.diff.changed).toBe(1);
    expect((await readPublishedCatalogue(db))[0]!.specs[0]!.evidence.sourceUrl).toBe(original.sourceUrl);
    await approveRelease(db, corrected.releaseId, { actor: 'test', note: 'Synthetic corrected provenance' });
    await publishRelease(db, corrected.releaseId, { actor: 'test', expectedPreviousReleaseId: legacy.releaseId });
    const entry = (await readPublishedCatalogue(db))[0]!;
    expect(entry.specs[0]!.evidence.sourceUrl).toBe('https://example.test/new/0');
    expect(entry.ratings[0]!.evidence.sourceUrl).toBe('https://example.test/new/0');
    await rollbackRelease(db, legacy.releaseId, { actor: 'test', expectedPreviousReleaseId: corrected.releaseId });
    expect((await readPublishedCatalogue(db))[0]!.specs[0]!.evidence.sourceUrl).toBe(original.sourceUrl);
    const cleared = await stageImport(db, stagedInput([{ ...original, sourceUrl: null }], 'clear-invalid-url'));
    await approveRelease(db, cleared.releaseId, { actor: 'test', note: 'Source no longer supplies a verified product URL' });
    await publishRelease(db, cleared.releaseId, { actor: 'test', expectedPreviousReleaseId: legacy.releaseId });
    expect((await readPublishedCatalogue(db))[0]!.specs[0]!.evidence.sourceUrl).toBeNull();
    expect((await db.query<{ count: number }>('select count(*)::int count from padlownia.source_records')).rows[0]!.count).toBe(1);
  } finally { await close(); }
});

it('checks duplicate external identities from the selected parser run rather than the first interpretation', async () => {
  const { db, close } = await openLocalDatabase();
  try {
    await setSourcePermission(db, 'padeltrue', { reference: 'Authored synthetic fixture', scope: { synthetic: true } });
    const originals = [validRecord(0), validRecord(1)];
    await stageImport(db, stagedInput(originals, 'first-parser'));
    const reprocessed = await stageImport(db, stagedInput(originals.map((record) => ({ ...record, externalId: 'same-source-id' })), 'corrected-parser'));
    expect(reprocessed.gate.blockers).toContain('DUPLICATE_EXTERNAL_IDS');
    await expect(approveRelease(db, reprocessed.releaseId, { actor: 'test', note: 'Must stay blocked' })).rejects.toThrow('RELEASE_GATE_BLOCKED');
  } finally { await close(); }
});
