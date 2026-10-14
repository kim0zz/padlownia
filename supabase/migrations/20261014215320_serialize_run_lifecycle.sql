-- Lock order: publication state (activation only), target release, run UUIDs.
-- Review/retirement lock run UUIDs and never take a release row lock afterwards.
-- Run locks therefore serialize approval against an unpublished run's retirement.
create or replace function padlownia.protect_run_supersession() returns trigger language plpgsql
set search_path=pg_catalog,padlownia as $$
begin
  if old.superseded_by_run_id is not null then raise exception 'SUPERSEDED_RUN_IMMUTABLE'; end if;
  if new.superseded_by_run_id is not null then
    -- The application locks both endpoints in UUID order before its UPDATE.
    -- Lock the successor here too so direct SQL cannot validate stale state.
    -- Opposite direct UPDATEs may deadlock; PostgreSQL aborts one, preserving integrity.
    perform id from padlownia.ingestion_runs where id=new.superseded_by_run_id for update;
    if new.id=new.superseded_by_run_id or old.status not in ('staged','review_required')
      or exists(select 1 from padlownia.release_sources rs join padlownia.catalog_releases cr on cr.id=rs.release_id where rs.run_id=old.id and cr.status<>'draft')
      or not exists(select 1 from padlownia.ingestion_runs successor where successor.id=new.superseded_by_run_id
        and successor.source_id=old.source_id and successor.snapshot_id=old.snapshot_id and successor.actual_count=old.actual_count
        and successor.status in ('staged','review_required') and successor.id<>old.id
        and (successor.parser_version,successor.normalizer_version,successor.matching_version) is distinct from (old.parser_version,old.normalizer_version,old.matching_version)
        and successor.actual_count=(select count(*) from padlownia.record_results rr where rr.run_id=successor.id))
    then raise exception 'INVALID_RUN_SUPERSESSION'; end if;
  end if;
  return new;
end $$;

create or replace function padlownia.approve_release(target uuid, actor text, note text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,padlownia as $$
declare gate jsonb; target_status text;
begin
  if coalesce(length(trim(actor)),0)=0 or coalesce(length(trim(note)),0)=0 then raise exception 'EXPLICIT_APPROVAL_REQUIRED'; end if;
  select status into target_status from padlownia.catalog_releases where id=target for update;
  if target_status is null or target_status<>'draft' then raise exception 'RELEASE_NOT_DRAFT'; end if;
  perform r.id from padlownia.ingestion_runs r join padlownia.release_sources rs on rs.run_id=r.id
    where rs.release_id=target order by r.id for update of r;
  gate := padlownia.release_gate(target);
  if not (gate->>'allowed')::boolean then raise exception 'RELEASE_GATE_BLOCKED'; end if;
  update padlownia.catalog_releases set status='approved',approved_by=actor,approval_note=note,approved_at=now(),quality_report=gate where id=target;
  return gate;
end $$;

create or replace function padlownia.activate_release(target uuid, expected_previous uuid, actor text, rollback boolean default false)
returns void language plpgsql security definer set search_path=pg_catalog,padlownia as $$
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
  elsif target_status<>'approved' or target_status is null then raise exception 'RELEASE_NOT_APPROVED';
  end if;
  perform r.id from padlownia.ingestion_runs r join padlownia.release_sources rs on rs.run_id=r.id
    where rs.release_id=target order by r.id for update of r;
  gate := padlownia.release_gate(target);
  -- Preserve the established rollback exception for sources added after the old release.
  if rollback then
    gate := jsonb_set(gate,'{blockers}',coalesce((select jsonb_agg(v) from jsonb_array_elements(gate->'blockers') v where v<>'"ACTIVE_SOURCE_OMITTED"'::jsonb),'[]'::jsonb));
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

-- CREATE OR REPLACE preserves existing ACLs; repeat boundaries explicitly for audit.
revoke all on function padlownia.protect_run_supersession() from public,anon,authenticated,padlownia_reader;
revoke all on function padlownia.approve_release(uuid,text,text) from public,anon,authenticated,padlownia_reader;
revoke all on function padlownia.activate_release(uuid,uuid,text,boolean) from public,anon,authenticated,padlownia_reader;
grant execute on function padlownia.approve_release(uuid,text,text) to padlownia_worker,service_role;
grant execute on function padlownia.activate_release(uuid,uuid,text,boolean) to padlownia_worker,service_role;
