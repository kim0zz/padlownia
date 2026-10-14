-- Diff semantic content, including ratings and source attribution, while ignoring
-- generated IDs/retrieval timestamps that change on an otherwise identical parse.
create function padlownia.racket_evidence_fingerprint(target uuid, racket uuid) returns text
language sql stable set search_path = pg_catalog, padlownia as $$
  select md5(jsonb_build_object(
    'specs',coalesce((select jsonb_agg((to_jsonb(o)-'id'-'result_id') || jsonb_build_object('source',ds.code,'url',sr.source_url,'externalId',sr.external_id) order by ds.code,sr.external_id,o.ordinal)
      from padlownia.spec_observations o join padlownia.record_results rr on rr.id=o.result_id
      join padlownia.source_entity_matches m on m.result_id=rr.id and m.racket_id=racket and m.decision in ('auto_accepted','new_identity','manually_accepted')
      join padlownia.release_sources rs on rs.run_id=rr.run_id and rs.release_id=target
      join padlownia.source_records sr on sr.id=rr.source_record_id join padlownia.data_sources ds on ds.id=rs.source_id),'[]'::jsonb),
    'ratings',coalesce((select jsonb_agg((to_jsonb(o)-'id'-'result_id') || jsonb_build_object('source',ds.code,'url',sr.source_url,'externalId',sr.external_id) order by ds.code,sr.external_id,o.ordinal)
      from padlownia.source_ratings o join padlownia.record_results rr on rr.id=o.result_id
      join padlownia.source_entity_matches m on m.result_id=rr.id and m.racket_id=racket and m.decision in ('auto_accepted','new_identity','manually_accepted')
      join padlownia.release_sources rs on rs.run_id=rr.run_id and rs.release_id=target
      join padlownia.source_records sr on sr.id=rr.source_record_id join padlownia.data_sources ds on ds.id=rs.source_id),'[]'::jsonb)
  )::text);
$$;

create function padlownia.release_gate(target uuid) returns jsonb
language sql stable security definer set search_path = pg_catalog, padlownia as $$
  with runs as (
    select r.* from padlownia.ingestion_runs r join padlownia.release_sources s on s.run_id=r.id where s.release_id=target
  ), reasons as (
    select 'RELEASE_NOT_FOUND' code where not exists(select 1 from padlownia.catalog_releases where id=target)
    union all select 'NO_SOURCE_RUNS' where not exists(select 1 from runs)
    union all select 'EMPTY_CATALOGUE' where not exists(select 1 from padlownia.racket_projections where release_id=target)
    union all select 'IMPORT_NOT_STAGED' where exists(select 1 from runs where status not in ('staged','review_required'))
    union all select 'INCOMPLETE_SNAPSHOT' where exists(select 1 from runs r where
      r.actual_count <> (select count(*) from padlownia.record_results rr where rr.run_id=r.id)
      or (r.declared_count is not null and r.declared_count <> r.actual_count))
    union all select 'DUPLICATE_EXTERNAL_IDS' where exists(
      select sr.external_id from padlownia.source_records sr join runs r on r.snapshot_id=sr.snapshot_id
      group by sr.snapshot_id,sr.external_id having count(*)>1)
    union all select 'INVALID_RECORDS' where exists(select 1 from padlownia.record_results rr join runs r on r.id=rr.run_id where rr.status='invalid')
    union all select 'UNRESOLVED_REVIEW' where exists(select 1 from padlownia.review_queue q join runs r on r.id=q.run_id where q.status <> 'accepted')
    union all select 'UNACCEPTED_IDENTITY' where exists(
      select 1 from padlownia.record_results rr join runs r on r.id=rr.run_id
      left join padlownia.source_entity_matches m on m.result_id=rr.id
      where m.racket_id is null or m.decision not in ('auto_accepted','new_identity','manually_accepted'))
    union all select 'UNVERIFIED_STORAGE' where exists(select 1 from runs r join padlownia.source_snapshots ss on ss.id=r.snapshot_id where not ss.storage_verified)
    union all select 'SOURCE_PERMISSION_REQUIRED' where exists(
      select 1 from runs r join padlownia.data_sources s on s.id=r.source_id
      where not s.enabled or s.rights_status <> 'approved' or not s.catalogue_display_allowed or coalesce(length(s.permission_reference),0)=0)
    union all select 'SOURCE_RUN_MISMATCH' where exists(
      select 1 from padlownia.release_sources rs join runs r on r.id=rs.run_id where rs.release_id=target and rs.source_id<>r.source_id)
    union all select 'ACTIVE_SOURCE_OMITTED' where exists(
      select 1 from padlownia.release_sources prior join padlownia.catalog_state cs on cs.active_release_id=prior.release_id
      where not exists(select 1 from padlownia.release_sources next where next.release_id=target and next.source_id=prior.source_id))
    union all select 'DANGLING_PROJECTION_EVIDENCE' where exists(
      select 1 from padlownia.projection_specs ps
      join padlownia.spec_observations o on o.id=ps.observation_id
      join padlownia.record_results rr on rr.id=o.result_id
      left join padlownia.source_entity_matches m on m.result_id=rr.id
      where ps.release_id=target and (o.validation_status<>'valid' or o.attribute_key<>ps.attribute_key
        or m.racket_id is distinct from ps.racket_id or m.decision not in ('auto_accepted','new_identity','manually_accepted')
        or not exists(select 1 from runs r where r.id=rr.run_id)))
    union all select 'INVALID_CANONICAL_EVIDENCE' where exists(
      select 1 from padlownia.projection_specs ps join padlownia.spec_observations o on o.id=ps.observation_id
      where ps.release_id=target and (
        o.claim_type in ('measured_specimen','editorial_assessment')
        or o.measurement_context->>'grips' = 'one_overgrip'
        or o.measurement_context->>'configuration' = 'nonstandard_unspecified'
        or (o.attribute_key='balance' and o.numeric_value is not null and o.measurement_context->>'referencePoint' is distinct from 'butt')))
    union all select 'UNPROJECTED_IDENTITY' where exists(
      select 1 from padlownia.record_results rr join runs r on r.id=rr.run_id join padlownia.source_entity_matches m on m.result_id=rr.id
      where m.decision in ('auto_accepted','new_identity','manually_accepted') and not exists(
        select 1 from padlownia.racket_projections p where p.release_id=target and p.racket_id=m.racket_id))
    union all select 'UNSOURCED_PROJECTION' where exists(
      select 1 from padlownia.racket_projections p where p.release_id=target and not exists(
        select 1 from padlownia.source_entity_matches m join padlownia.record_results rr on rr.id=m.result_id join runs r on r.id=rr.run_id
        where m.racket_id=p.racket_id and m.decision in ('auto_accepted','new_identity','manually_accepted')))
    union all select 'UNBACKED_CANONICAL_VALUE' where exists(
      select 1 from padlownia.racket_projections p where p.release_id=target and (
        (p.shape is not null and not exists(select 1 from padlownia.projection_specs ps join padlownia.spec_observations o on o.id=ps.observation_id where ps.release_id=p.release_id and ps.racket_id=p.racket_id and ps.attribute_key='shape' and o.normalized_text=p.shape))
        or ((p.weight_min_g is not null or p.weight_max_g is not null) and not exists(select 1 from padlownia.projection_specs ps join padlownia.spec_observations o on o.id=ps.observation_id where ps.release_id=p.release_id and ps.racket_id=p.racket_id and ps.attribute_key='weight' and o.unit='g' and p.weight_min_g is not distinct from coalesce(o.value_min,o.numeric_value) and p.weight_max_g is not distinct from coalesce(o.value_max,o.numeric_value)))
        or (p.balance_cm is not null and not exists(select 1 from padlownia.projection_specs ps join padlownia.spec_observations o on o.id=ps.observation_id where ps.release_id=p.release_id and ps.racket_id=p.racket_id and ps.attribute_key='balance' and o.unit='cm' and o.numeric_value=p.balance_cm))
        or (p.core_normalized is not null and not exists(select 1 from padlownia.projection_specs ps join padlownia.spec_observations o on o.id=ps.observation_id where ps.release_id=p.release_id and ps.racket_id=p.racket_id and ps.attribute_key='core' and o.normalized_text=p.core_normalized))
        or (p.surface_normalized is not null and not exists(select 1 from padlownia.projection_specs ps join padlownia.spec_observations o on o.id=ps.observation_id where ps.release_id=p.release_id and ps.racket_id=p.racket_id and ps.attribute_key='surface' and o.normalized_text=p.surface_normalized))
      ))
  ) select jsonb_build_object(
    'releaseId',target,
    'allowed',not exists(select 1 from reasons),
    'blockers',coalesce((select jsonb_agg(code order by code) from reasons),'[]'::jsonb),
    'sourceCount',(select count(*) from runs),
    'recordCount',(select count(*) from padlownia.record_results rr join runs r on r.id=rr.run_id),
    'racketCount',(select count(*) from padlownia.racket_projections where release_id=target),
    'diff',jsonb_build_object(
      'added',(select count(*) from padlownia.racket_projections p where p.release_id=target and not exists(select 1 from padlownia.racket_projections prior join padlownia.catalog_state cs on cs.active_release_id=prior.release_id where prior.racket_id=p.racket_id)),
      'removed',(select count(*) from padlownia.racket_projections prior join padlownia.catalog_state cs on cs.active_release_id=prior.release_id where not exists(select 1 from padlownia.racket_projections p where p.release_id=target and p.racket_id=prior.racket_id)),
      'changed',(select count(*) from padlownia.racket_projections p join padlownia.racket_projections prior on prior.racket_id=p.racket_id join padlownia.catalog_state cs on cs.active_release_id=prior.release_id where p.release_id=target and ((to_jsonb(p)-'release_id') is distinct from (to_jsonb(prior)-'release_id')
        or padlownia.racket_evidence_fingerprint(target,p.racket_id) is distinct from padlownia.racket_evidence_fingerprint(prior.release_id,p.racket_id)))
    )
  );
$$;

create function padlownia.activate_release(target uuid, expected_previous uuid, actor text, rollback boolean default false)
returns void language plpgsql security definer set search_path = pg_catalog, padlownia as $$
declare current_id uuid; gate jsonb; target_status text;
begin
  if actor is null or length(trim(actor))=0 then raise exception 'ACTOR_REQUIRED'; end if;
  select active_release_id into current_id from padlownia.catalog_state where singleton for update;
  if current_id is distinct from expected_previous then raise exception 'STALE_ACTIVE_RELEASE'; end if;
  select status into target_status from padlownia.catalog_releases where id=target for update;
  if rollback then
    if target_status not in ('published','superseded') or not exists(select 1 from padlownia.publication_events where release_id=target) then
      raise exception 'INVALID_ROLLBACK_TARGET';
    end if;
  elsif target_status <> 'approved' or target_status is null then raise exception 'RELEASE_NOT_APPROVED';
  end if;
  gate := padlownia.release_gate(target);
  -- A previously published release may legitimately predate an added source.
  -- Retain every other gate, especially current source permissions and evidence.
  if rollback then
    gate := jsonb_set(gate,'{blockers}',coalesce((select jsonb_agg(v) from jsonb_array_elements(gate->'blockers') v where v <> '"ACTIVE_SOURCE_OMITTED"'::jsonb),'[]'::jsonb));
    gate := jsonb_set(gate,'{allowed}',to_jsonb(jsonb_array_length(gate->'blockers')=0));
  end if;
  if not (gate->>'allowed')::boolean then raise exception 'RELEASE_GATE_BLOCKED'; end if;
  if current_id=target then return; end if;
  update padlownia.catalog_releases set status='superseded' where id=current_id;
  update padlownia.catalog_releases set status='published' where id=target;
  update padlownia.catalog_state set active_release_id=target where singleton;
  insert into padlownia.publication_events(release_id,previous_release_id,action,actor)
  values(target,current_id,case when rollback then 'rollback' else 'publish' end,actor);
end $$;

-- Approved projections read immutable evidence from exactly the pinned runs.
create function padlownia.published_catalogue() returns table(entry jsonb)
language sql stable security definer set search_path = pg_catalog, padlownia as $$
  with active as (
    select r.id from padlownia.catalog_state s join padlownia.catalog_releases r on r.id=s.active_release_id
    where r.status='published' and not exists(
      select 1 from padlownia.release_sources rs join padlownia.data_sources ds on ds.id=rs.source_id
      where rs.release_id=r.id and (not ds.enabled or ds.rights_status<>'approved' or not ds.catalogue_display_allowed))
  ), observations as (
    select o.*,m.racket_id,rs.release_id,sr.source_url,ds.code,ds.display_name,ss.retrieved_at
    from padlownia.spec_observations o
    join padlownia.record_results rr on rr.id=o.result_id
    join padlownia.source_entity_matches m on m.result_id=rr.id and m.decision in ('auto_accepted','new_identity','manually_accepted')
    join padlownia.release_sources rs on rs.run_id=rr.run_id join active a on a.id=rs.release_id
    join padlownia.source_records sr on sr.id=rr.source_record_id
    join padlownia.source_snapshots ss on ss.id=sr.snapshot_id
    join padlownia.data_sources ds on ds.id=ss.source_id
  ), ratings as (
    select o.*,m.racket_id,rs.release_id,sr.source_url,ds.code,ds.display_name,ss.retrieved_at
    from padlownia.source_ratings o
    join padlownia.record_results rr on rr.id=o.result_id
    join padlownia.source_entity_matches m on m.result_id=rr.id and m.decision in ('auto_accepted','new_identity','manually_accepted')
    join padlownia.release_sources rs on rs.run_id=rr.run_id join active a on a.id=rs.release_id
    join padlownia.source_records sr on sr.id=rr.source_record_id
    join padlownia.source_snapshots ss on ss.id=sr.snapshot_id
    join padlownia.data_sources ds on ds.id=ss.source_id
  ) select jsonb_build_object(
    'releaseId',p.release_id,'id',r.id,'brand',r.brand,'model',r.model,'variant',r.variant_key,'modelYear',r.model_year,
    'shape',p.shape,'weightMinG',p.weight_min_g,'weightMaxG',p.weight_max_g,'balanceCm',p.balance_cm,'core',p.core_normalized,'surface',p.surface_normalized,
    'specs',coalesce((select jsonb_agg(jsonb_build_object(
      'key',o.attribute_key,'rawValue',o.raw_value,'normalizedText',o.normalized_text,'numericValue',o.numeric_value,
      'valueMin',o.value_min,'valueMax',o.value_max,'unit',o.unit,'claimType',o.claim_type,'validationStatus',o.validation_status,
      'measurementContext',o.measurement_context,'selected',exists(select 1 from padlownia.projection_specs ps where ps.release_id=p.release_id and ps.racket_id=r.id and ps.observation_id=o.id),
      'conflict',p.conflict_flags ? o.attribute_key,
      'evidence',jsonb_build_object('observationId',o.id,'sourceCode',o.code,'sourceName',o.display_name,'sourceUrl',o.source_url,'retrievedAt',o.retrieved_at,'path',o.evidence_path,'attribution',o.attribution)
    ) order by o.attribute_key,o.code,o.ordinal) from observations o where o.racket_id=r.id and o.release_id=p.release_id),'[]'::jsonb),
    'ratings',coalesce((select jsonb_agg(jsonb_build_object(
      'dimension',o.dimension_key,'rawValue',o.raw_value,'value',o.numeric_score,'scaleMin',o.scale_min,'scaleMax',o.scale_max,'kind',o.rating_kind,'validationStatus',o.validation_status,'methodology',o.methodology,
      'evidence',jsonb_build_object('observationId',o.id,'sourceCode',o.code,'sourceName',o.display_name,'sourceUrl',o.source_url,'retrievedAt',o.retrieved_at,'path',o.evidence_path,'attribution',null)
    ) order by o.dimension_key,o.code,o.ordinal) from ratings o where o.racket_id=r.id and o.release_id=p.release_id),'[]'::jsonb)
  ) from padlownia.racket_projections p join active a on a.id=p.release_id join padlownia.rackets r on r.id=p.racket_id
  order by r.brand,r.model,r.model_year nulls last,r.id;
$$;

-- A pinned match cannot be changed underneath an approved release.
create function padlownia.protect_pinned_match() returns trigger language plpgsql
set search_path = pg_catalog, padlownia as $$ begin
  if exists(select 1 from padlownia.record_results rr join padlownia.release_sources rs on rs.run_id=rr.run_id
    join padlownia.catalog_releases cr on cr.id=rs.release_id where rr.id=old.result_id and cr.status<>'draft') then
    raise exception 'IMMUTABLE_RELEASE_MATCH';
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
create trigger protect_pinned_match before update or delete on padlownia.source_entity_matches
for each row execute function padlownia.protect_pinned_match();

create function padlownia.protect_pinned_evidence_insert() returns trigger language plpgsql
set search_path = pg_catalog, padlownia as $$
declare target_run uuid;
begin
  if tg_table_name='record_results' then
    target_run := new.run_id;
  else
    select run_id into target_run from padlownia.record_results where id=new.result_id;
  end if;
  if exists(select 1 from padlownia.release_sources rs join padlownia.catalog_releases cr on cr.id=rs.release_id
    where rs.run_id=target_run and cr.status<>'draft') then raise exception 'IMMUTABLE_RELEASE_EVIDENCE'; end if;
  return new;
end $$;
create trigger protect_pinned_result_insert before insert on padlownia.record_results
for each row execute function padlownia.protect_pinned_evidence_insert();
create trigger protect_pinned_observation_insert before insert on padlownia.spec_observations
for each row execute function padlownia.protect_pinned_evidence_insert();
create trigger protect_pinned_rating_insert before insert on padlownia.source_ratings
for each row execute function padlownia.protect_pinned_evidence_insert();
create trigger protect_pinned_match_insert before insert on padlownia.source_entity_matches
for each row execute function padlownia.protect_pinned_evidence_insert();

revoke all on all functions in schema padlownia from public, anon, authenticated, padlownia_reader;
grant execute on function padlownia.release_gate(uuid) to padlownia_worker,service_role;
grant execute on function padlownia.activate_release(uuid,uuid,text,boolean) to padlownia_worker,service_role;
grant execute on function padlownia.published_catalogue() to padlownia_reader,padlownia_worker,service_role;
