import { createHash } from "node:crypto";
import {
  MATCH_RULE_VERSION, resolveIdentity, selectProjection,
  type AttributedObservation, type IdentityCandidate, type Issue, type Json,
  type MatchDecision, type NormalizedRecord, type RecordError, type SourceCode,
} from "@padlownia/domain";
import type { SqlExecutor } from "./executor.js";

export interface StageImportInput {
  source: SourceCode;
  sha256: string;
  retrievedAt: string;
  storage: { bucket: "source-snapshots"; path: string; verified: boolean };
  parserVersion: string;
  normalizerVersion: string;
  declaredCount: number | null;
  actualCount: number;
  records: NormalizedRecord[];
  recordErrors: RecordError[];
  issues?: Issue[];
}
export interface ImportMetrics { valid: number; invalid: number; reviewRequired: number; total: number }
export interface GateReport {
  releaseId: string;
  allowed: boolean;
  blockers: string[];
  sourceCount: number;
  recordCount: number;
  racketCount: number;
  diff: { added: number; removed: number; changed: number };
}
export interface StageImportResult {
  runId: string;
  releaseId: string;
  replayed: boolean;
  metrics: ImportMetrics;
  gate: GateReport;
}
const hash = (value: string): string => createHash("sha256").update(value).digest("hex");
const json = (value: unknown): string => JSON.stringify(value);

async function sourceId(db: SqlExecutor, source: SourceCode): Promise<string> {
  const sourceRow = (await db.query<{ id: string }>("select id from padlownia.data_sources where code=$1 and enabled", [source])).rows[0];
  if (!sourceRow) throw new Error("SOURCE_UNAVAILABLE");
  return sourceRow.id;
}

/** Explicit rights record; only use real permission evidence or isolated synthetic fixtures. */
export async function setSourcePermission(db: SqlExecutor, source: SourceCode, permission: { reference: string; scope: Record<string, Json> }): Promise<void> {
  if (!permission.reference.trim()) throw new Error("PERMISSION_REFERENCE_REQUIRED");
  await db.query("update padlownia.data_sources set rights_status='approved',catalogue_display_allowed=true,permission_reference=$2,permission_scope=$3::jsonb where code=$1", [source,permission.reference,json(permission.scope)]);
}

async function persistRecord(db: SqlExecutor, runId: string, snapshotId: string, record: NormalizedRecord | RecordError): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.query("select id from padlownia.ingestion_runs where id=$1 for update", [runId]);
    const normalized = "identity" in record ? record : null;
    await tx.query(`insert into padlownia.source_records(snapshot_id,input_index,external_id,external_id_scope,source_url,raw_payload,payload_sha256)
      values($1,$2,$3,$4,$5,$6::jsonb,$7) on conflict(snapshot_id,input_index) do nothing`,
    [snapshotId,record.inputIndex,record.externalId,normalized?.externalIdScope ?? "snapshot",normalized?.sourceUrl ?? null,json(record.rawPayload),hash(json(record.rawPayload))]);
    const raw = (await tx.query<{ id: string; payload_sha256: string }>("select id,payload_sha256 from padlownia.source_records where snapshot_id=$1 and input_index=$2", [snapshotId,record.inputIndex])).rows[0]!;
    if (raw.payload_sha256 !== hash(json(record.rawPayload))) throw new Error("SNAPSHOT_RECORD_HASH_MISMATCH");
    const existing = (await tx.query("select id from padlownia.record_results where run_id=$1 and source_record_id=$2", [runId,raw.id])).rows.length;
    if (existing) return;
    // A later parser can recover an invalid row or correct its source link/ID.
    // Keep that interpretation pinned to this run; the shared raw row stays immutable.
    const result = (await tx.query<{ id: string }>(`insert into padlownia.record_results(run_id,source_record_id,snapshot_id,status,issues,external_id,external_id_scope,source_url)
      values($1,$2,$3,$4,$5::jsonb,$6,$7,$8) returning id`, [runId,raw.id,snapshotId,normalized?.status ?? "invalid",json(record.issues),record.externalId,normalized?.externalIdScope ?? "snapshot",normalized?.sourceUrl ?? null])).rows[0]!;
    if (!normalized) {
      await tx.query("insert into padlownia.review_queue(run_id,result_id,reason_code) values($1,$2,'INVALID_RECORD')", [runId,result.id]);
      return;
    }
    const candidates = (await tx.query<{ id: string; identity: IdentityCandidate["identity"] }>("select id,normalized_identity as identity from padlownia.rackets where brand_key=$1", [normalized.identity.brandKey])).rows;
    const decision: MatchDecision = normalized.status === "invalid"
      ? { decision: "needs_review",racketId: null,candidateIds: [],reasonCodes: ["invalid_record"],ruleVersion: MATCH_RULE_VERSION }
      : resolveIdentity(normalized.identity,candidates);
    let racketId = decision.racketId;
    if (decision.decision === "new_identity") {
      await tx.query(`insert into padlownia.rackets(identity_key,brand_key,model_key,variant_key,model_year,brand,model,normalized_identity)
        values($1,$2,$3,$4,$5,$6,$7,$8::jsonb) on conflict(identity_key) do nothing`,
      [normalized.identity.identityKey,normalized.identity.brandKey,normalized.identity.modelKey,normalized.identity.variantKey,normalized.identity.year,normalized.identity.brand,normalized.identity.name,json(normalized.identity)]);
      racketId = (await tx.query<{ id: string }>("select id from padlownia.rackets where identity_key=$1", [normalized.identity.identityKey])).rows[0]!.id;
    }
    await tx.query(`insert into padlownia.source_entity_matches(result_id,racket_id,decision,candidate_ids,reason_codes,rule_version)
      values($1,$2,$3,$4::jsonb,$5::jsonb,$6)`, [result.id,racketId,decision.decision,json(decision.candidateIds),json(decision.reasonCodes),decision.ruleVersion]);
    if (normalized.status !== "valid" || decision.decision === "needs_review") {
      await tx.query("insert into padlownia.review_queue(run_id,result_id,reason_code) values($1,$2,$3)", [runId,result.id,normalized.status === "invalid" ? "INVALID_RECORD" : decision.decision === "needs_review" ? "IDENTITY_REVIEW" : "NORMALIZATION_REVIEW"]);
    }
    // Batch evidence within the same record transaction: two round trips regardless
    // of its field count. JSON null must stay JSON null rather than SQL NULL.
    if (normalized.observations.length) {
      await tx.query(`insert into padlownia.spec_observations(result_id,ordinal,attribute_key,raw_value,normalized_text,numeric_value,value_min,value_max,unit,measurement_context,claim_type,validation_status,attribution,evidence_path,issues)
        select $1,o.ordinal,o.attribute_key,coalesce(o.raw_value,'null'::jsonb),o.normalized_text,o.numeric_value,o.value_min,o.value_max,o.unit,o.measurement_context,o.claim_type,o.validation_status,coalesce(o.attribution,'null'::jsonb),o.evidence_path,o.issues
        from jsonb_to_recordset($2::jsonb) as o(ordinal integer,attribute_key text,raw_value jsonb,normalized_text text,numeric_value numeric,value_min numeric,value_max numeric,unit text,measurement_context jsonb,claim_type text,validation_status text,attribution jsonb,evidence_path text,issues jsonb)`,
      [result.id,json(normalized.observations.map((o,ordinal) => ({ ordinal,attribute_key: o.key,raw_value: o.rawValue,normalized_text: o.normalizedText,
        numeric_value: o.numericValue,value_min: o.valueMin,value_max: o.valueMax,unit: o.unit,measurement_context: o.context,
        claim_type: o.kind,validation_status: o.status,attribution: o.attribution,evidence_path: o.rawSourcePath,issues: o.issues }))) ]);
    }
    if (normalized.ratings.length) {
      await tx.query(`insert into padlownia.source_ratings(result_id,ordinal,dimension_key,raw_value,numeric_score,scale_min,scale_max,methodology,rating_kind,validation_status,evidence_path,issues)
        select $1,r.ordinal,r.dimension_key,coalesce(r.raw_value,'null'::jsonb),r.numeric_score,r.scale_min,r.scale_max,r.methodology,r.rating_kind,r.validation_status,r.evidence_path,r.issues
        from jsonb_to_recordset($2::jsonb) as r(ordinal integer,dimension_key text,raw_value jsonb,numeric_score numeric,scale_min numeric,scale_max numeric,methodology text,rating_kind text,validation_status text,evidence_path text,issues jsonb)`,
      [result.id,json(normalized.ratings.map((r,ordinal) => ({ ordinal,dimension_key: r.key,raw_value: r.rawValue,numeric_score: r.numericScore,
        scale_min: r.scaleMin,scale_max: r.scaleMax,methodology: r.methodology,rating_kind: r.kind,validation_status: r.status,evidence_path: r.rawSourcePath,issues: r.issues }))) ]);
    }
  });
}

export async function stageImport(db: SqlExecutor, input: StageImportInput): Promise<StageImportResult> {
  if (!/^[a-f0-9]{64}$/.test(input.sha256)) throw new Error("INVALID_SNAPSHOT_HASH");
  if (input.records.some((r) => r.source !== input.source)) throw new Error("SOURCE_CONTRACT_MISMATCH");
  const inputIndices = [...input.records,...input.recordErrors].map((r) => r.inputIndex);
  if (new Set(inputIndices).size !== inputIndices.length) throw new Error("DUPLICATE_INPUT_INDEX");
  const source = await sourceId(db,input.source);
  const key = hash([input.source,input.sha256,input.parserVersion,input.normalizerVersion,MATCH_RULE_VERSION,"stage-v1"].join(":"));
  const start = await db.transaction(async (tx) => {
    await tx.query(`insert into padlownia.source_snapshots(source_id,retrieved_at,sha256,storage_bucket,storage_path,storage_verified)
      values($1,$2,$3,$4,$5,$6) on conflict(source_id,sha256) do nothing`, [source,input.retrievedAt,input.sha256,input.storage.bucket,input.storage.path,input.storage.verified]);
    const snapshotId = (await tx.query<{ id: string }>("select id from padlownia.source_snapshots where source_id=$1 and sha256=$2", [source,input.sha256])).rows[0]!.id;
    const created = await tx.query<{ id: string }>(`insert into padlownia.ingestion_runs(source_id,snapshot_id,parser_version,normalizer_version,matching_version,idempotency_key,declared_count,actual_count)
      values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(idempotency_key) do nothing returning id`, [source,snapshotId,input.parserVersion,input.normalizerVersion,MATCH_RULE_VERSION,key,input.declaredCount,input.actualCount]);
    const run = (await tx.query<{ id: string; status: string }>("select id,status from padlownia.ingestion_runs where idempotency_key=$1", [key])).rows[0]!;
    if (created.rows.length) {
      await tx.query("insert into padlownia.run_events(run_id,stage,code) values($1,'staging','IMPORT_STARTED')", [run.id]);
      for (const issue of input.issues ?? []) {
        await tx.query("insert into padlownia.review_queue(run_id,reason_code) values($1,$2)", [run.id,issue.code]);
      }
    }
    return { runId: run.id, snapshotId, replayed: created.rows.length === 0 };
  });
  try {
    for (const record of [...input.records,...input.recordErrors].sort((a,b) => a.inputIndex-b.inputIndex)) {
      await persistRecord(db,start.runId,start.snapshotId,record);
    }
    const counts = (await db.query<{ total: string; valid: string; invalid: string; review: string }>(`select count(*)::text total,
      count(*) filter(where status='valid')::text valid,count(*) filter(where status='invalid')::text invalid,
      count(*) filter(where status='needs_review')::text review from padlownia.record_results where run_id=$1`, [start.runId])).rows[0]!;
    const pending = (await db.query<{ count: string }>("select count(*)::text count from padlownia.review_queue where run_id=$1 and status<>'accepted'", [start.runId])).rows[0]!;
    const metrics = { total: Number(counts.total), valid: Number(counts.valid), invalid: Number(counts.invalid), reviewRequired: Math.max(Number(counts.review),Number(pending.count)) };
    const complete = metrics.total === input.actualCount && (input.declaredCount === null || input.declaredCount === input.actualCount);
    const status = !complete || metrics.invalid ? "partial" : metrics.reviewRequired ? "review_required" : "staged";
    await db.query("update padlownia.ingestion_runs set status=$2,metrics=$3::jsonb,completed_at=now() where id=$1", [start.runId,status,json(metrics)]);
    await db.query("insert into padlownia.run_events(run_id,stage,code) values($1,'staging',$2)", [start.runId,start.replayed ? "IMPORT_REPLAYED" : "IMPORT_STAGED"]);
    const releaseId = await createRelease(db,[start.runId]);
    const gate = await evaluateRelease(db,releaseId);
    return { runId: start.runId, releaseId, replayed: start.replayed, metrics, gate };
  } catch {
    await db.query("update padlownia.ingestion_runs set status='failed_retryable' where id=$1", [start.runId]);
    await db.query("insert into padlownia.run_events(run_id,stage,code) values($1,'staging','DATABASE_STAGE_FAILED')", [start.runId]);
    throw new Error("DATABASE_STAGE_FAILED");
  }
}

export async function createRelease(db: SqlExecutor, runIds: string[]): Promise<string> {
  if (!runIds.length || new Set(runIds).size !== runIds.length) throw new Error("INVALID_RELEASE_RUNS");
  const datasetHash = hash([...runIds].sort().join(":"));
  return db.transaction(async (tx) => {
    await tx.query("select pg_advisory_xact_lock(hashtext('padlownia:create-release'))");
    const existing = (await tx.query<{ id: string; status: string }>("select id,status from padlownia.catalog_releases where dataset_hash=$1 order by release_number limit 1 for update", [datasetHash])).rows[0];
    if (existing && existing.status !== "draft") return existing.id;
    const release = existing ?? (await tx.query<{ id: string }>(`insert into padlownia.catalog_releases(dataset_hash,expected_previous_release_id)
      select $1,active_release_id from padlownia.catalog_state returning id`, [datasetHash])).rows[0]!;
    if (existing) {
      await tx.query("delete from padlownia.projection_specs where release_id=$1", [release.id]);
      await tx.query("delete from padlownia.racket_projections where release_id=$1", [release.id]);
    } else {
      for (const runId of runIds) {
        const run = (await tx.query<{ source_id: string }>("select source_id from padlownia.ingestion_runs where id=$1", [runId])).rows[0];
        if (!run) throw new Error("RELEASE_RUN_NOT_FOUND");
        await tx.query("insert into padlownia.release_sources(release_id,source_id,run_id) values($1,$2,$3)", [release.id,run.source_id,runId]);
      }
    }
    const rackets = (await tx.query<{ id: string }>(`select distinct m.racket_id as id from padlownia.source_entity_matches m
      join padlownia.record_results rr on rr.id=m.result_id join padlownia.release_sources rs on rs.run_id=rr.run_id
      where rs.release_id=$1 and m.decision in ('auto_accepted','new_identity','manually_accepted')`, [release.id])).rows;
    for (const racket of rackets) {
      const observations = (await tx.query<{ observation: AttributedObservation }>(`select jsonb_build_object(
        'id',o.id,'source',ds.code,'sourceUrl',case when rr.external_id is null then sr.source_url else rr.source_url end,'externalId',coalesce(rr.external_id,sr.external_id),
        'key',o.attribute_key,'rawValue',o.raw_value,'rawSourcePath',o.evidence_path,'kind',o.claim_type,
        'context',o.measurement_context,'attribution',o.attribution,'status',o.validation_status,
        'normalizedText',o.normalized_text,'numericValue',o.numeric_value,'valueMin',o.value_min,'valueMax',o.value_max,
        'unit',o.unit,'issues',o.issues) observation
        from padlownia.spec_observations o join padlownia.record_results rr on rr.id=o.result_id
        join padlownia.source_entity_matches m on m.result_id=rr.id
        join padlownia.release_sources rs on rs.run_id=rr.run_id
        join padlownia.source_records sr on sr.id=rr.source_record_id
        join padlownia.data_sources ds on ds.id=rs.source_id
        where rs.release_id=$1 and m.racket_id=$2 and m.decision in ('auto_accepted','new_identity','manually_accepted')`, [release.id,racket.id])).rows.map((r) => r.observation);
      const selection = selectProjection(observations);
      const specs = selection.selected;
      const weight = specs.weight?.unit === "g" ? specs.weight : undefined;
      await tx.query(`insert into padlownia.racket_projections(release_id,racket_id,shape,weight_min_g,weight_max_g,balance_cm,core_normalized,surface_normalized,conflict_flags)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`, [release.id,racket.id,specs.shape?.normalizedText ?? null,
      weight?.valueMin ?? weight?.numericValue ?? null,weight?.valueMax ?? weight?.numericValue ?? null,
      specs.balance?.unit === "cm" ? specs.balance.numericValue : null,specs.core?.normalizedText ?? null,specs.surface?.normalizedText ?? null,json(selection.conflicts)]);
      for (const [attribute,o] of Object.entries(specs)) {
        await tx.query("insert into padlownia.projection_specs(release_id,racket_id,attribute_key,observation_id) values($1,$2,$3,$4)", [release.id,racket.id,attribute,o.id]);
      }
    }
    return release.id;
  });
}

export async function evaluateRelease(db: SqlExecutor, releaseId: string): Promise<GateReport> {
  return (await db.query<{ report: GateReport }>("select padlownia.release_gate($1) report", [releaseId])).rows[0]!.report;
}

export async function approveRelease(db: SqlExecutor, releaseId: string, approval: { actor: string; note: string }): Promise<GateReport> {
  if (!approval.actor.trim() || !approval.note.trim()) throw new Error("EXPLICIT_APPROVAL_REQUIRED");
  return (await db.query<{ report: GateReport }>("select padlownia.approve_release($1,$2,$3) report", [releaseId,approval.actor,approval.note])).rows[0]!.report;
}

export async function publishRelease(db: SqlExecutor, releaseId: string, options: { actor: string; expectedPreviousReleaseId: string | null }): Promise<void> {
  await db.query("select padlownia.activate_release($1,$2,$3,false)", [releaseId,options.expectedPreviousReleaseId,options.actor]);
}
export async function rollbackRelease(db: SqlExecutor, releaseId: string, options: { actor: string; expectedPreviousReleaseId: string | null }): Promise<void> {
  await db.query("select padlownia.activate_release($1,$2,$3,true)", [releaseId,options.expectedPreviousReleaseId,options.actor]);
}
