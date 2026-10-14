import { afterEach,beforeEach,describe,expect,it } from 'vitest';
import { normalizeRecord,type SourceRecord } from '@padlownia/domain';
import { applySourceReview,supersedeReviewedRun,stageImport,openLocalDatabase,evaluateRelease,createRelease,approveRelease,publishRelease,setSourcePermission,type SqlExecutor,type StageImportInput,type SourceReviewDecision } from '@padlownia/database';

const source:SourceRecord={contractVersion:'1.0.0',source:'padeltrue',inputIndex:0,externalId:'synthetic-unknown',externalIdScope:'source',sourceUrl:'https://example.test/unknown',identity:{brand:'Testlab',name:'Distinct Control',year:null},observations:[],ratings:[],metadata:{},rawPayload:{id:'synthetic-unknown',year:null},issues:[]};
const data=(version='synthetic-v1'):StageImportInput=>({source:'padeltrue',sha256:'a'.repeat(64),retrievedAt:'2026-10-14T00:00:00Z',storage:{bucket:'source-snapshots',path:`padeltrue/${'a'.repeat(64)}.json`,verified:true},parserVersion:version,normalizerVersion:version,declaredCount:1,actualCount:1,records:[normalizeRecord(source)],recordErrors:[]});
describe('evidence review and safe retirement of unpublished interpretations',()=>{
  let db:SqlExecutor,close:()=>Promise<void>;
  beforeEach(async()=>{({db,close}=await openLocalDatabase());});
  afterEach(async()=>{await close();});
  async function staged(version='synthetic-v1'){
    const run=await stageImport(db,data(version));
    const result=(await db.query<{id:string}>('select id from padlownia.record_results where run_id=$1',[run.runId])).rows[0]!;
    const decision:SourceReviewDecision={runId:run.runId,resultId:result.id,externalId:source.externalId,snapshotSha256:'a'.repeat(64),expectedMatch:'needs_review',reviewer:'synthetic-reviewer',rationale:'Source explicitly lacks a year. Preserve year=null as distinct from every dated variant.',evidence:[{sourceUrl:source.sourceUrl!,snapshotSha256:'a'.repeat(64),path:'/rackets/0/year',finding:'Source year field is explicitly null; no year is inferred.'}],identity:source.identity};
    return {...run,decision};
  }
  it('accepts an evidenced unknown year without inventing it, replays exactly and preserves original results',async()=>{
    const known=normalizeRecord({...source,externalId:'synthetic-known',identity:{...source.identity,year:2026},rawPayload:{id:'synthetic-known',year:2026}});
    await stageImport(db,{...data(),sha256:'b'.repeat(64),storage:{bucket:'source-snapshots',path:`padeltrue/${'b'.repeat(64)}.json`,verified:true},records:[known]});
    const run=await staged();
    const result=await db.transaction(async tx=>{await tx.query('set local role padlownia_worker');return applySourceReview(tx,run.decision);});
    expect(result.replayed).toBe(false);
    expect(await applySourceReview(db,run.decision)).toEqual({...result,replayed:true});
    expect((await db.query<{model_year:number|null}>('select model_year from padlownia.rackets where id=$1',[result.racketId])).rows[0]!.model_year).toBeNull();
    expect((await db.query('select id from padlownia.rackets')).rows).toHaveLength(2);
    expect((await db.query<{status:string}>('select status from padlownia.record_results where run_id=$1',[run.runId])).rows[0]!.status).toBe('needs_review');
    const release=await createRelease(db,[run.runId]);
    expect((await evaluateRelease(db,release)).blockers).toEqual(['SOURCE_PERMISSION_REQUIRED']);
    await expect(applySourceReview(db,{...run.decision,rationale:'A changed reviewed interpretation cannot silently overwrite the original review.'})).rejects.toThrow('REVIEW_STALE_DECISION');
  });
  it('rejects wrong source hashes, unrelated evidence and missing identity before accepting review',async()=>{
    const run=await staged();
    await expect(applySourceReview(db,{...run.decision,snapshotSha256:'b'.repeat(64)})).rejects.toThrow('REVIEW_TARGET_MISMATCH');
    await expect(applySourceReview(db,{...run.decision,evidence:[]})).rejects.toThrow('REVIEW_EVIDENCE_REQUIRED');
    await expect(applySourceReview(db,{...run.decision,evidence:run.decision.evidence.map(e=>({...e,sourceUrl:'https://example.test/different'}))})).rejects.toThrow('REVIEW_PRIMARY_EVIDENCE_REQUIRED');
    await expect(applySourceReview(db,{...run.decision,identity:undefined})).rejects.toThrow('REVIEW_IDENTITY_REQUIRED');
    expect((await db.query<{status:string}>('select status from padlownia.review_queue')).rows[0]!.status).toBe('pending');
  });
  it('supersedes only complete same-snapshot revisions and blocks publication/replay of retired runs',async()=>{
    const prior=await staged(),successor=await staged('synthetic-v2');
    await supersedeReviewedRun(db,prior.runId,successor.runId,'synthetic-reviewer');
    await supersedeReviewedRun(db,prior.runId,successor.runId,'synthetic-reviewer');
    expect((await evaluateRelease(db,prior.releaseId)).blockers).toContain('IMPORT_NOT_STAGED');
    expect((await db.query<{status:string}>('select status from padlownia.review_queue where run_id=$1',[prior.runId])).rows[0]!.status).toBe('accepted');
    await expect(stageImport(db,data())).rejects.toThrow('SUPERSEDED_RUN_REPROCESS_FORBIDDEN');
    await expect(db.query("update padlownia.ingestion_runs set status='review_required',superseded_by_run_id=null where id=$1",[prior.runId])).rejects.toThrow('SUPERSEDED_RUN_IMMUTABLE');
    await expect(supersedeReviewedRun(db,successor.runId,prior.runId,'synthetic-reviewer')).rejects.toThrow('INVALID_RUN_SUPERSESSION');
    expect((await db.query('select id from padlownia.record_results')).rows).toHaveLength(2);
  });
  it('does not alter identities or retire a pinned published interpretation',async()=>{
    const prior=await staged();
    await applySourceReview(db,prior.decision);
    const release=await createRelease(db,[prior.runId]);
    await setSourcePermission(db,'padeltrue',{reference:'Synthetic fixture only',scope:{synthetic:true}});
    await approveRelease(db,release,{actor:'test',note:'Synthetic reviewed fixture'});
    await publishRelease(db,release,{actor:'test',expectedPreviousReleaseId:null});
    await expect(applySourceReview(db,prior.decision)).rejects.toThrow('REVIEW_RUN_PINNED');
    const successor=await staged('synthetic-v2');
    await expect(supersedeReviewedRun(db,prior.runId,successor.runId,'test')).rejects.toThrow('INVALID_RUN_SUPERSESSION');
  });
  // PGlite has one connection. Exercise both committed outcomes of the run-lock
  // serialization without claiming this simulates a multi-connection lock race.
  it.each([true,false])('serializes approval and retirement safely when approval comes first: %s',async(approvalFirst)=>{
    const prior=await staged(),successor=await staged('synthetic-v2');
    await applySourceReview(db,prior.decision);
    const release=await createRelease(db,[prior.runId]);
    await setSourcePermission(db,'padeltrue',{reference:'Synthetic fixture only',scope:{synthetic:true}});
    const approval=()=>approveRelease(db,release,{actor:'test',note:'Synthetic reviewed fixture'});
    const retirement=()=>supersedeReviewedRun(db,prior.runId,successor.runId,'test');
    if(approvalFirst){
      await approval();
      await expect(retirement()).rejects.toThrow('INVALID_RUN_SUPERSESSION');
      expect((await evaluateRelease(db,release)).allowed).toBe(true);
    }else{
      await retirement();
      await expect(approval()).rejects.toThrow('RELEASE_GATE_BLOCKED');
      expect((await evaluateRelease(db,release)).blockers).toContain('IMPORT_NOT_STAGED');
    }
    expect((await db.query<{status:string}>('select status from padlownia.catalog_releases where id=$1',[release])).rows[0]!.status).toBe(approvalFirst?'approved':'draft');
  });
  it.each([true,false])('opposite retirement requests cannot form a cycle, first direction: %s',async(forward)=>{
    const first=await staged(),second=await staged('synthetic-v2');
    const prior=forward?first:second,successor=forward?second:first;
    await db.transaction(async tx=>{await tx.query('set local role padlownia_worker');await supersedeReviewedRun(tx,prior.runId,successor.runId,'test');});
    await expect(supersedeReviewedRun(db,successor.runId,prior.runId,'test')).rejects.toThrow('INVALID_RUN_SUPERSESSION');
    await supersedeReviewedRun(db,prior.runId,successor.runId,'test');
    const rows=(await db.query<{id:string;status:string;superseded_by_run_id:string|null}>('select id,status,superseded_by_run_id from padlownia.ingestion_runs')).rows;
    expect(rows.find(row=>row.id===prior.runId)).toMatchObject({status:'superseded',superseded_by_run_id:successor.runId});
    expect(rows.find(row=>row.id===successor.runId)).toMatchObject({status:'review_required',superseded_by_run_id:null});
    expect((await db.query("select id from padlownia.run_events where code='SUPERSEDED_BY_REPROCESSED_RUN'")).rows).toHaveLength(1);
    // Retiring an interpretation does not accept the replacement's pending evidence.
    expect((await db.query<{status:string}>('select status from padlownia.review_queue where run_id=$1',[successor.runId])).rows[0]!.status).toBe('pending');
    expect((await db.query('select id from padlownia.record_results')).rows).toHaveLength(2);
  });
  it('rejects missing/self retirement targets without changing review history',async()=>{
    const prior=await staged();
    await expect(supersedeReviewedRun(db,prior.runId,prior.runId,'test')).rejects.toThrow('REVIEW_TARGET_MISMATCH');
    await expect(supersedeReviewedRun(db,prior.runId,'00000000-0000-0000-0000-000000000000','test')).rejects.toThrow('REVIEW_TARGET_MISMATCH');
    expect((await db.query<{status:string}>('select status from padlownia.review_queue where run_id=$1',[prior.runId])).rows[0]!.status).toBe('pending');
  });
  it('keeps publication functions unavailable to catalogue readers after replacement',async()=>{
    const run=await staged();
    for(const sql of ['select padlownia.approve_release($1,\'test\',\'synthetic fixture approval\')','select padlownia.activate_release($1,null,\'test\',false)']){
      await expect(db.transaction(async tx=>{await tx.query('set local role padlownia_reader');await tx.query(sql,[run.releaseId]);})).rejects.toThrow(/permission denied/i);
    }
  });
});
