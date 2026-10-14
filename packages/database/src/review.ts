import { normalizeIdentity,type SourceIdentity } from '@padlownia/domain';
import type { SqlExecutor } from './executor.js';

export interface ReviewEvidence { sourceUrl: string; snapshotSha256: string; path: string; finding: string }
export interface SourceReviewDecision {
  runId: string; resultId: string; externalId: string; snapshotSha256: string;
  expectedMatch: string; reviewer: string; rationale: string; evidence: ReviewEvidence[];
  identity?: SourceIdentity;
}
export class ReviewError extends Error { constructor(public readonly code: string) { super(code); } }
const reject=(code:string):never=>{throw new ReviewError(code);};
const hash=(value:string)=>/^[a-f0-9]{64}$/.test(value);
const uuid=(value:string)=>/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value);
function validate(decision:SourceReviewDecision) {
  if (!uuid(decision.runId)||!uuid(decision.resultId)||!hash(decision.snapshotSha256)||!decision.externalId
    ||!decision.reviewer.trim()||decision.rationale.trim().length<30||!decision.evidence.length) reject('REVIEW_EVIDENCE_REQUIRED');
  for(const evidence of decision.evidence) {
    let url:URL;try{url=new URL(evidence.sourceUrl);}catch{reject('REVIEW_EVIDENCE_INVALID');}
    if(url!.protocol!=='https:'||url!.username||url!.password||!hash(evidence.snapshotSha256)||!evidence.path||evidence.finding.trim().length<10) reject('REVIEW_EVIDENCE_INVALID');
  }
  if(decision.identity) {
    if(decision.identity.year!==null&&(!Number.isInteger(decision.identity.year)||decision.identity.year<1980||decision.identity.year>2100)) reject('REVIEW_IDENTITY_INVALID');
    if(normalizeIdentity(decision.identity).issues.some(issue=>issue.severity==='error')) reject('REVIEW_IDENTITY_INVALID');
  }
}

/** Explicit evidence-based adjudication under delegated reviewer authority; never changes original observations. */
export async function applySourceReview(db:SqlExecutor,decision:SourceReviewDecision):Promise<{replayed:boolean;racketId:string}> {
  validate(decision);
  return db.transaction(async tx=>{
    const row=(await tx.query<{status:string;external_id:string;source_url:string;snapshot_sha256:string;decision:string;racket_id:string|null}>(`select r.status,rr.external_id,rr.source_url,ss.sha256 snapshot_sha256,m.decision,m.racket_id
      from padlownia.record_results rr join padlownia.ingestion_runs r on r.id=rr.run_id join padlownia.source_snapshots ss on ss.id=r.snapshot_id
      join padlownia.source_entity_matches m on m.result_id=rr.id where rr.id=$1 and r.id=$2 for update of r,m`,[decision.resultId,decision.runId])).rows[0];
    if(!row||row.external_id!==decision.externalId||row.snapshot_sha256!==decision.snapshotSha256) reject('REVIEW_TARGET_MISMATCH');
    if(!decision.evidence.some(e=>e.snapshotSha256===row.snapshot_sha256&&e.sourceUrl===row.source_url)) reject('REVIEW_PRIMARY_EVIDENCE_REQUIRED');
    if(!['staged','review_required'].includes(row.status)) reject('REVIEW_RUN_NOT_REVIEWABLE');
    if((await tx.query(`select 1 from padlownia.release_sources rs join padlownia.catalog_releases cr on cr.id=rs.release_id where rs.run_id=$1 and cr.status<>'draft'`,[decision.runId])).rows.length) reject('REVIEW_RUN_PINNED');
    const note=JSON.stringify({version:'source-review-v1',rationale:decision.rationale,evidence:decision.evidence,identity:decision.identity??null});
    const reviews=(await tx.query<{status:string;reviewer:string|null;resolution_note:string|null}>('select status,reviewer,resolution_note from padlownia.review_queue where run_id=$1 and result_id=$2 for update',[decision.runId,decision.resultId])).rows;
    if(!reviews.length) reject('REVIEW_QUEUE_ITEM_REQUIRED');
    if(reviews.every(q=>q.status==='accepted'&&q.reviewer===decision.reviewer&&q.resolution_note===note)&&row.racket_id) return {replayed:true,racketId:row.racket_id};
    if(reviews.some(q=>q.status!=='pending')||row.decision!==decision.expectedMatch) reject('REVIEW_STALE_DECISION');
    let racketId=row.racket_id;
    if(decision.identity) {
      const identity=normalizeIdentity(decision.identity);
      await tx.query(`insert into padlownia.rackets(identity_key,brand_key,model_key,variant_key,model_year,brand,model,normalized_identity)
        values($1,$2,$3,$4,$5,$6,$7,$8::jsonb) on conflict(identity_key) do nothing`,[identity.identityKey,identity.brandKey,identity.modelKey,identity.variantKey,identity.year,identity.brand,identity.name,JSON.stringify(identity)]);
      racketId=(await tx.query<{id:string}>('select id from padlownia.rackets where identity_key=$1',[identity.identityKey])).rows[0]!.id;
      await tx.query(`update padlownia.source_entity_matches set racket_id=$2,decision='manually_accepted',reviewed_by=$3,reviewed_at=now(),reason_codes=$4::jsonb where result_id=$1`,[decision.resultId,racketId,decision.reviewer,JSON.stringify(['explicit_source_evidence_review'])]);
    } else if(!racketId||!['auto_accepted','new_identity','manually_accepted'].includes(row.decision)) reject('REVIEW_IDENTITY_REQUIRED');
    await tx.query(`update padlownia.review_queue set status='accepted',reviewer=$3,resolution_note=$4,resolved_at=now() where run_id=$1 and result_id=$2 and status='pending'`,[decision.runId,decision.resultId,decision.reviewer,note]);
    await tx.query("insert into padlownia.run_events(run_id,stage,code) values($1,'review','SOURCE_EVIDENCE_REVIEW_ACCEPTED')",[decision.runId]);
    return {replayed:false,racketId:racketId!};
  });
}

/** Retire an unpublished interpretation after complete same-snapshot reprocessing; preserve every original output. */
export async function supersedeReviewedRun(db:SqlExecutor,prior:string,successor:string,reviewer:string):Promise<void> {
  if(!uuid(prior)||!uuid(successor)||prior===successor||!reviewer.trim()) reject('REVIEW_TARGET_MISMATCH');
  await db.transaction(async tx=>{
    // Lock both ends before inspecting either: opposite retirement requests cannot
    // observe two staged runs and create a cycle. Publication uses the same order.
    const runs=(await tx.query<{id:string;superseded_by_run_id:string|null}>(
      'select id,superseded_by_run_id from padlownia.ingestion_runs where id=any($1::uuid[]) order by id for update',[[prior,successor]])).rows;
    const old=runs.find(run=>run.id===prior);
    if(!old||runs.length!==2) return reject('REVIEW_TARGET_MISMATCH');
    if(old.superseded_by_run_id===successor) return;
    await tx.query("update padlownia.ingestion_runs set status='superseded',superseded_by_run_id=$2 where id=$1",[prior,successor]);
    await tx.query(`update padlownia.review_queue set status='accepted',reviewer=$2,resolved_at=now(),resolution_note=$3 where run_id=$1 and status='pending'`,[prior,reviewer,JSON.stringify({version:'source-review-v1',disposition:'superseded_interpretation',successorRunId:successor,note:'Original interpretation retained for audit; successor uses corrected parser and separate evidence review. Prior run cannot publish.'})]);
    await tx.query("insert into padlownia.run_events(run_id,stage,code) values($1,'review','SUPERSEDED_BY_REPROCESSED_RUN')",[prior]);
  });
}
