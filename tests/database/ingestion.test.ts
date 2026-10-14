import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { normalizeRecord, type NormalizedRecord, type SourceRecord } from "@padlownia/domain";
import {
  approveRelease, assertDevelopmentDatabase, createRelease, evaluateRelease, openLocalDatabase, publishRelease,
  readPublishedCatalogue, rollbackRelease, setSourcePermission, stageImport,
  type SqlExecutor, type StageImportInput,
} from "@padlownia/database";

// Entirely synthetic records authored for tests. No third-party dataset or credentials.
function record(index = 0, overrides: Partial<SourceRecord> = {}): NormalizedRecord {
  return normalizeRecord({
    contractVersion: "1.0.0", source: "padeltrue", inputIndex: index, externalId: `synthetic-${index}`,
    externalIdScope: "source", sourceUrl: `https://example.test/rackets/${index}`,
    identity: { brand: "Testlab", name: `Synthetic ${index} Pro`, year: 2026 },
    observations: [
      { key: "weight",rawValue: "365 ± 5 g",rawSourcePath: `/rackets/${index}/weight`,kind: "manufacturer_declared",context: {},attribution: { name: "Synthetic manufacturer",url: "https://example.test/manufacturer",verified: true } },
      { key: "shape",rawValue: "round",rawSourcePath: `/rackets/${index}/shape`,kind: "unknown",context: {},attribution: null },
    ],
    ratings: [{ key: "power",rawValue: 82,rawSourcePath: `/rackets/${index}/power`,numericScore: 82,scaleMin: 0,scaleMax: 100,methodology: "synthetic:derived:v1",kind: "rule_derived",status: "valid",issues: [] }],
    metadata: {},rawPayload: { id: `synthetic-${index}`, brand: "Testlab", model: `Synthetic ${index} Pro`,weight: "365 ± 5 g" },issues: [],
    ...overrides,
  });
}
function input(records = [record()], overrides: Partial<StageImportInput> = {}): StageImportInput {
  const sha256 = createHash("sha256").update(JSON.stringify(records.map((r) => r.rawPayload))).digest("hex");
  return { source: "padeltrue",sha256,retrievedAt: "2026-10-13T10:00:00Z",storage: { bucket: "source-snapshots",path: `padeltrue/${sha256}.json`,verified: true },parserVersion: "test-1",normalizerVersion: "test-1",declaredCount: records.length,actualCount: records.length,records,recordErrors: [],...overrides };
}

describe("PostgreSQL ingestion, permissions and publication (PGlite, isolated synthetic data)", () => {
  let db: SqlExecutor;
  let close: () => Promise<void>;
  beforeEach(async () => {
    ({ db,close } = await openLocalDatabase());
    await setSourcePermission(db,"padeltrue",{ reference: "Synthetic fixture authored by project, tests only",scope: { synthetic: true,catalogue: true } });
  });
  afterEach(async () => { await close?.(); });
  async function publish(data = input(), previous: string | null = null) {
    const staged = await stageImport(db,data);
    await approveRelease(db,staged.releaseId,{ actor: "test-reviewer",note: "Reviewed synthetic fixture and deterministic gate" });
    await publishRelease(db,staged.releaseId,{ actor: "test-reviewer",expectedPreviousReleaseId: previous });
    return staged;
  }

  it("ING-001/003/022: stores provenance, keeps staging invisible and replays without duplicating data", async () => {
    const staged = await stageImport(db,input());
    expect(staged.metrics).toEqual({ valid: 1,invalid: 0,reviewRequired: 0,total: 1 });
    expect(staged.gate.allowed).toBe(true);
    expect(await readPublishedCatalogue(db)).toEqual([]);
    await expect(publishRelease(db,staged.releaseId,{ actor: "test",expectedPreviousReleaseId: null })).rejects.toThrow("RELEASE_NOT_APPROVED");
    await approveRelease(db,staged.releaseId,{ actor: "test-reviewer",note: "Explicit isolated fixture acceptance" });
    await publishRelease(db,staged.releaseId,{ actor: "test",expectedPreviousReleaseId: null });
    const replay = await stageImport(db,input());
    expect(replay.replayed).toBe(true);
    expect(replay.runId).toBe(staged.runId);
    expect(replay.releaseId).toBe(staged.releaseId);
    const catalogue = await readPublishedCatalogue(db);
    expect(catalogue).toHaveLength(1);
    expect(catalogue[0]).toMatchObject({ weightMinG: 360,weightMaxG: 370,shape: "round",modelYear: 2026 });
    expect(catalogue[0]!.specs.find((s) => s.key === "weight")).toMatchObject({ rawValue: "365 ± 5 g",selected: true,claimType: "manufacturer_declared",evidence: { sourceCode: "padeltrue",path: "/rackets/0/weight" } });
    expect(catalogue[0]!.ratings[0]).toMatchObject({ value: 82,scaleMax: 100,kind: "rule_derived",methodology: "synthetic:derived:v1" });
    expect(JSON.stringify(catalogue)).not.toMatch(/raw_payload|storage_path|source-snapshots|permission_reference/);
    const counts = await db.query<{ snapshots: number; records: number; observations: number; releases: number }>(`select
      (select count(*)::int from padlownia.source_snapshots) snapshots,
      (select count(*)::int from padlownia.source_records) records,
      (select count(*)::int from padlownia.spec_observations) observations,
      (select count(*)::int from padlownia.catalog_releases) releases`);
    expect(counts.rows[0]).toEqual({ snapshots: 1,records: 1,observations: 2,releases: 1 });
  });

  it("ING-004/005: incomplete snapshot and invalid rows remain staged, never replace active catalogue", async () => {
    const prior = await publish();
    const badRaw = { unexpected: "still retained" };
    const staged = await stageImport(db,input([record(1)],{ sha256: "a".repeat(64),declaredCount: 4,actualCount: 3,recordErrors: [
      { inputIndex: 2,externalId: "broken-2",rawPayload: badRaw,issues: [{ code: "missing_brand",path: "/2",severity: "error" }] },
    ] }));
    expect(staged.gate.blockers).toEqual(expect.arrayContaining(["INCOMPLETE_SNAPSHOT","INVALID_RECORDS","IMPORT_NOT_STAGED","UNRESOLVED_REVIEW"]));
    expect(staged.metrics).toMatchObject({ total: 2,invalid: 1,valid: 1 });
    expect((await db.query<{ raw_payload: unknown }>("select raw_payload from padlownia.source_records where external_id='broken-2'")).rows[0]!.raw_payload).toEqual(badRaw);
    await expect(approveRelease(db,staged.releaseId,{ actor: "test",note: "Must not override gate" })).rejects.toThrow("RELEASE_GATE_BLOCKED");
    expect((await readPublishedCatalogue(db))[0]!.releaseId).toBe(prior.releaseId);
  });

  it("ING-021/009: unknown year stays in review and never merges into a known-year product", async () => {
    await publish();
    const staged = await stageImport(db,input([record(1,{ identity: { brand: "Testlab",name: "Synthetic 0 Pro",year: null } })]));
    expect(staged.gate.blockers).toEqual(expect.arrayContaining(["UNACCEPTED_IDENTITY","UNRESOLVED_REVIEW"]));
    const matches = (await db.query<{ decision: string; racket_id: string | null }>("select decision,racket_id from padlownia.source_entity_matches m join padlownia.record_results rr on rr.id=m.result_id where rr.run_id=$1", [staged.runId])).rows;
    expect(matches).toEqual([{ decision: "needs_review",racket_id: null }]);
  });

  it("ING-015/017: changed snapshot is immutable, publication and rollback switch one release pointer", async () => {
    const prior = await publish();
    const changed = record(0);
    changed.rawPayload = { id: "synthetic-0",weight: "375 g" };
    changed.observations[0] = { ...changed.observations[0]!,rawValue: "375 g",valueMin: 375,valueMax: 375,numericValue: 375 };
    const staged = await stageImport(db,input([changed]));
    expect(staged.gate.diff.changed).toBe(1);
    expect((await readPublishedCatalogue(db))[0]!.weightMinG).toBe(360);
    await approveRelease(db,staged.releaseId,{ actor: "test",note: "Synthetic change inspected" });
    await publishRelease(db,staged.releaseId,{ actor: "test",expectedPreviousReleaseId: prior.releaseId });
    expect((await readPublishedCatalogue(db))[0]!.weightMinG).toBe(375);
    await rollbackRelease(db,prior.releaseId,{ actor: "test",expectedPreviousReleaseId: staged.releaseId });
    expect((await readPublishedCatalogue(db))[0]!.weightMinG).toBe(360);
    const events = (await db.query<{ action: string }>("select action from padlownia.publication_events order by id")).rows.map((e) => e.action);
    expect(events).toEqual(["publish","publish","rollback"]);
    expect((await db.query<{ count: number }>("select count(*)::int count from padlownia.source_snapshots")).rows[0]!.count).toBe(2);
  });

  it("ING-016: failure during activation rolls back status, audit and pointer atomically", async () => {
    const prior = await publish();
    const next = await stageImport(db,input([record(1)]));
    await approveRelease(db,next.releaseId,{ actor: "test",note: "Isolated fixture" });
    await db.query(`create function padlownia.test_fail_activation() returns trigger language plpgsql as $$ begin raise exception 'SIMULATED_WRITE_FAILURE'; end $$`);
    await db.query("create trigger test_fail_activation before update on padlownia.catalog_state for each row execute function padlownia.test_fail_activation()");
    await expect(publishRelease(db,next.releaseId,{ actor: "test",expectedPreviousReleaseId: prior.releaseId })).rejects.toThrow("SIMULATED_WRITE_FAILURE");
    expect((await readPublishedCatalogue(db))[0]!.releaseId).toBe(prior.releaseId);
    expect((await db.query<{ status: string }>("select status from padlownia.catalog_releases where id=$1", [next.releaseId])).rows[0]!.status).toBe("approved");
    expect((await db.query<{ count: number }>("select count(*)::int count from padlownia.publication_events")).rows[0]!.count).toBe(1);
  });

  it("ING-023: RLS denies raw data, reader can only read released output and buckets stay private", async () => {
    await publish();
    expect((await db.query<{ public: boolean }>("select public from storage.buckets")).rows.every((b) => !b.public)).toBe(true);
    expect((await db.query<{ relrowsecurity: boolean }>("select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='padlownia' and c.relkind='r'")).rows.every((r) => r.relrowsecurity)).toBe(true);
    await db.query("insert into storage.objects(bucket_id,name) values('source-snapshots','private.json')");
    await db.query("create policy unrelated_permissive_read on storage.objects for select to anon,authenticated using(true)");
    for (const role of ["anon","authenticated"]) {
      const rows = await db.transaction(async (tx) => {
        await tx.query(`set local role ${role}`);
        return (await tx.query("select * from storage.objects")).rows;
      });
      expect(rows).toEqual([]);
      await expect(db.transaction(async (tx) => {
        await tx.query(`set local role ${role}`);
        await tx.query("select * from padlownia.source_records");
      })).rejects.toThrow(/permission denied/);
      await expect(db.transaction(async (tx) => {
        await tx.query(`set local role ${role}`);
        await tx.query("insert into storage.objects(bucket_id,name) values('source-snapshots','denied')");
      })).rejects.toThrow(/row-level security/);
    }
    const published = await db.transaction(async (tx) => {
      await tx.query("set local role padlownia_reader");
      return readPublishedCatalogue(tx);
    });
    expect(published).toHaveLength(1);
    await expect(db.transaction(async (tx) => {
      await tx.query("set local role padlownia_reader");
      await tx.query("select * from padlownia.source_records");
    })).rejects.toThrow(/permission denied/);
    await expect(db.transaction(async (tx) => {
      await tx.query("set local role padlownia_reader");
      await tx.query("select padlownia.activate_release(null,null,'unauthorized',false)");
    })).rejects.toThrow(/permission denied/);
  });

  it("ING-018/029: resumes a failed row transaction, and parser changes preserve earlier outputs", async () => {
    const data = input([record(0),record(1)]);
    let failed = false;
    const failingDb: SqlExecutor = {
      query: db.query,
      transaction: (work) => db.transaction((tx) => work({ ...tx,query: async <T>(sql: string,params: unknown[] = []) => {
        if (!failed && sql.includes("insert into padlownia.source_records") && params[1] === 1) { failed = true; throw new Error("secret=must-not-escape"); }
        return tx.query<T>(sql,params);
      } })),
    };
    await expect(stageImport(failingDb,data)).rejects.toThrow(/^DATABASE_STAGE_FAILED$/);
    expect((await db.query<{ count: number }>("select count(*)::int count from padlownia.record_results")).rows[0]!.count).toBe(1);
    const resumed = await stageImport(db,data);
    expect(resumed.replayed).toBe(true);
    expect(resumed.metrics.total).toBe(2);
    const reprocessed = await stageImport(db,{ ...data,parserVersion: "test-2" });
    expect(reprocessed.runId).not.toBe(resumed.runId);
    expect((await db.query<{ count: number }>("select count(*)::int count from padlownia.source_snapshots")).rows[0]!.count).toBe(1);
    expect((await db.query<{ count: number }>("select count(*)::int count from padlownia.source_records")).rows[0]!.count).toBe(2);
    expect((await db.query<{ count: number }>("select count(*)::int count from padlownia.spec_observations")).rows[0]!.count).toBe(8);
  });

  it("source rights and storage verification are publication prerequisites; withdrawn source closes reader", async () => {
    const staged = await stageImport(db,input([record(0,{ source: "padelhow" })],{ source: "padelhow",storage: { bucket: "source-snapshots",path: "padelhow/unverified.json",verified: false } }));
    expect(staged.gate.blockers).toEqual(expect.arrayContaining(["SOURCE_PERMISSION_REQUIRED","UNVERIFIED_STORAGE"]));
    const prior = await publish();
    await db.query("update padlownia.data_sources set rights_status='disallowed',catalogue_display_allowed=false where code='padeltrue'");
    expect(await readPublishedCatalogue(db)).toEqual([]);
    await expect(rollbackRelease(db,prior.releaseId,{ actor: "test",expectedPreviousReleaseId: prior.releaseId })).rejects.toThrow("RELEASE_GATE_BLOCKED");
  });

  it("published history cannot mutate through projections, raw payloads, observations or matches", async () => {
    const prior = await publish();
    await expect(db.query("update padlownia.source_records set raw_payload='{}'::jsonb")).rejects.toThrow("IMMUTABLE_HISTORY");
    await expect(db.query("delete from padlownia.spec_observations")).rejects.toThrow("IMMUTABLE_HISTORY");
    await expect(db.query("update padlownia.racket_projections set shape='diamond' where release_id=$1", [prior.releaseId])).rejects.toThrow("IMMUTABLE_RELEASE");
    await expect(db.query("update padlownia.source_entity_matches set decision='rejected'")).rejects.toThrow("IMMUTABLE_RELEASE_MATCH");
    await expect(db.query(`insert into padlownia.spec_observations(result_id,ordinal,attribute_key,raw_value,claim_type,validation_status,evidence_path)
      select result_id,999,'injected','"hidden change"'::jsonb,'unknown','valid','/injected' from padlownia.spec_observations limit 1`)).rejects.toThrow("IMMUTABLE_RELEASE_EVIDENCE");
  });

  it("unbacked canonical data and stale publication are blocked even after draft creation", async () => {
    const prior = await publish();
    const next = await stageImport(db,input([record(1)]));
    await db.query("update padlownia.racket_projections set weight_min_g=1 where release_id=$1", [next.releaseId]);
    expect((await evaluateRelease(db,next.releaseId)).blockers).toContain("UNBACKED_CANONICAL_VALUE");
    await db.query("update padlownia.racket_projections set weight_min_g=360 where release_id=$1", [next.releaseId]);
    await approveRelease(db,next.releaseId,{ actor: "test",note: "Reviewed" });
    await expect(publishRelease(db,next.releaseId,{ actor: "test",expectedPreviousReleaseId: null })).rejects.toThrow("STALE_ACTIVE_RELEASE");
    expect((await readPublishedCatalogue(db))[0]!.releaseId).toBe(prior.releaseId);
  });

  it("preserves duplicated source IDs and rejects incomplete refresh of active source collection", async () => {
    const duplicate = await stageImport(db,input([record(0),record(1,{ externalId: "synthetic-0" })]));
    expect(duplicate.gate.blockers).toContain("DUPLICATE_EXTERNAL_IDS");
    const first = await stageImport(db,input());
    await setSourcePermission(db,"padelhow",{ reference: "Synthetic fixture only",scope: { synthetic: true } });
    const second = await stageImport(db,input([record(2,{ source: "padelhow" })],{ source: "padelhow" }));
    const combined = await createRelease(db,[first.runId,second.runId]);
    await approveRelease(db,combined,{ actor: "test",note: "Both synthetic sources reviewed" });
    await publishRelease(db,combined,{ actor: "test",expectedPreviousReleaseId: null });
    const incompleteRefresh = await stageImport(db,input([record(3)]));
    expect(incompleteRefresh.gate.blockers).toContain("ACTIVE_SOURCE_OMITTED");
  });

  it("ING-032: reader errors never expose driver connection details", async () => {
    const broken: SqlExecutor = { query: async () => { throw new Error("postgres://user:secret@host/db"); },transaction: db.transaction };
    await expect(readPublishedCatalogue(broken)).rejects.toThrow(/^DATABASE_READ_FAILED$/);
  });

  it("retains normalized evidence of invalid records without creating a canonical identity", async () => {
    const invalid = record(0,{ identity: { brand: "",name: "Broken",year: 2026 } });
    expect(invalid.status).toBe("invalid");
    const staged = await stageImport(db,input([invalid]));
    expect(staged.gate.blockers).toContain("INVALID_RECORDS");
    expect((await db.query<{ count: number }>("select count(*)::int count from padlownia.spec_observations")).rows[0]!.count).toBe(2);
    expect((await db.query<{ count: number }>("select count(*)::int count from padlownia.source_ratings")).rows[0]!.count).toBe(1);
    expect((await db.query<{ count: number }>("select count(*)::int count from padlownia.rackets")).rows[0]!.count).toBe(0);
  });

  it("rebuilds a draft after an explicit manual identity review", async () => {
    await stageImport(db,input());
    const unknown = await stageImport(db,input([record(1,{ identity: { brand: "Testlab",name: "Synthetic 0 Pro",year: null } })]));
    expect(unknown.gate.racketCount).toBe(0);
    const racketId = (await db.query<{ id: string }>("select id from padlownia.rackets limit 1")).rows[0]!.id;
    await db.query(`update padlownia.source_entity_matches m set racket_id=$2,decision='manually_accepted',reviewed_by='test',reviewed_at=now()
      from padlownia.record_results rr where rr.id=m.result_id and rr.run_id=$1`, [unknown.runId,racketId]);
    await db.query("update padlownia.review_queue set status='accepted',reviewer='test',resolution_note='Synthetic identity explicitly adjudicated',resolved_at=now() where run_id=$1", [unknown.runId]);
    expect(await createRelease(db,[unknown.runId])).toBe(unknown.releaseId);
    expect((await evaluateRelease(db,unknown.releaseId))).toMatchObject({ allowed: true,racketCount: 1 });
  });

  it("rollback may return to a vetted release that predates an added source", async () => {
    const first = await publish();
    await setSourcePermission(db,"padelhow",{ reference: "Synthetic fixture",scope: { synthetic: true } });
    const second = await stageImport(db,input([record(2,{ source: "padelhow" })],{ source: "padelhow" }));
    const combined = await createRelease(db,[first.runId,second.runId]);
    await approveRelease(db,combined,{ actor: "test",note: "Two sources reviewed" });
    await publishRelease(db,combined,{ actor: "test",expectedPreviousReleaseId: first.releaseId });
    expect(await readPublishedCatalogue(db)).toHaveLength(2);
    await rollbackRelease(db,first.releaseId,{ actor: "test",expectedPreviousReleaseId: combined });
    expect(await readPublishedCatalogue(db)).toHaveLength(1);
  });

  it("ING-010/027: specimen measurements cannot become a canonical declaration even via draft SQL", async () => {
    const testRecord = record();
    testRecord.observations.push({ ...testRecord.observations[0]!,kind: "measured_specimen",rawValue: "372 g with one overgrip",context: { grips: "one_overgrip" },numericValue: 372,valueMin: 372,valueMax: 372,attribution: null });
    const staged = await stageImport(db,input([testRecord]));
    expect(staged.gate.allowed).toBe(true);
    await db.query(`update padlownia.projection_specs set observation_id=(select id from padlownia.spec_observations where claim_type='measured_specimen') where release_id=$1 and attribute_key='weight'`, [staged.releaseId]);
    await db.query("update padlownia.racket_projections set weight_min_g=372,weight_max_g=372 where release_id=$1", [staged.releaseId]);
    expect((await evaluateRelease(db,staged.releaseId)).blockers).toContain("INVALID_CANONICAL_EVIDENCE");
    await expect(approveRelease(db,staged.releaseId,{ actor: "test",note: "Cannot bypass specimen policy" })).rejects.toThrow("RELEASE_GATE_BLOCKED");
  });

  it("worker login can stage/approve/publish through functions but cannot bypass the release gate", async () => {
    const staged = await db.transaction(async (tx) => {
      await tx.query("set local role padlownia_worker");
      const imported = await stageImport(tx,input());
      await approveRelease(tx,imported.releaseId,{ actor: "test-reviewer",note: "Explicit synthetic review" });
      await publishRelease(tx,imported.releaseId,{ actor: "test-reviewer",expectedPreviousReleaseId: null });
      return imported;
    });
    for (const sql of [
      "update padlownia.catalog_state set active_release_id=null",
      "update padlownia.catalog_releases set status='draft'",
      "insert into padlownia.publication_events(release_id,action,actor) values(null,'publish','bypass')",
    ]) {
      await expect(db.transaction(async (tx) => {
        await tx.query("set local role padlownia_worker");
        await tx.query(sql);
      })).rejects.toThrow(/permission denied/);
    }
    await expect(db.query("update padlownia.catalog_releases set status='draft' where id=$1", [staged.releaseId])).rejects.toThrow("INVALID_RELEASE_TRANSITION");
    expect((await readPublishedCatalogue(db))[0]!.releaseId).toBe(staged.releaseId);
  });

  it("release diff includes rating-only changes but not generated IDs from identical reprocessing", async () => {
    await publish();
    const reprocessed = await stageImport(db,input([record()],{ parserVersion: "test-2" }));
    expect(reprocessed.gate.diff.changed).toBe(0);
    const changed = record();
    changed.ratings[0] = { ...changed.ratings[0]!,rawValue: 90,numericScore: 90 };
    changed.rawPayload = { id: "synthetic-0",weight: "365 ± 5 g",power: 90 };
    const staged = await stageImport(db,input([changed]));
    expect(staged.gate.diff.changed).toBe(1);
    expect((await readPublishedCatalogue(db))[0]!.ratings[0]!.value).toBe(82);
  });

  it("runtime identities inherit least privilege and can read but never change the immutable environment marker", async () => {
    const roles = (await db.query<{ rolname: string; rolcanlogin: boolean; rolsuper: boolean; rolbypassrls: boolean }>("select rolname,rolcanlogin,rolsuper,rolbypassrls from pg_roles where rolname in ('padlownia_web','padlownia_ingest')")).rows;
    expect(roles).toHaveLength(2);
    expect(roles.every((r) => !r.rolcanlogin && !r.rolsuper && !r.rolbypassrls)).toBe(true);
    for (const role of ["padlownia_web","padlownia_ingest"]) {
      await db.transaction(async (tx) => {
        await tx.query(`set local role ${role}`);
        await assertDevelopmentDatabase(tx,"local");
      });
      await expect(db.transaction(async (tx) => {
        await tx.query(`set local role ${role}`);
        await tx.query("update padlownia.environment_identity set project_ref='abcdefghijklmnopqrst'");
      })).rejects.toThrow(/permission denied/);
    }
    await expect(db.query("update padlownia.environment_identity set project_ref='abcdefghijklmnopqrst'")).rejects.toThrow("IMMUTABLE_HISTORY");
    await expect(db.transaction(async (tx) => {
      await tx.query("set local role padlownia_web");
      await tx.query("select * from padlownia.source_records");
    })).rejects.toThrow(/permission denied/);
  });

  it("all non-singleton foreign keys have supporting indexes for release/evidence joins", async () => {
    const uncovered = await db.query<{ table_name: string }>(`select c.conrelid::regclass::text table_name
      from pg_constraint c join pg_namespace n on n.oid=c.connamespace
      where c.contype='f' and n.nspname='padlownia' and not exists(
        select 1 from pg_index i where i.indrelid=c.conrelid and i.indisvalid and c.conkey <@ i.indkey::smallint[])
      order by table_name`);
    expect(uncovered.rows).toEqual([{ table_name: "padlownia.catalog_state" }]);
  });
});
