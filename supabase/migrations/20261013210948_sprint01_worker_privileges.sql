-- Publication is mediated by gated functions, even for the ingestion login.
create function padlownia.protect_release_lifecycle() returns trigger language plpgsql
set search_path = pg_catalog, padlownia as $$
declare gate jsonb;
begin
  if tg_op='DELETE' then raise exception 'IMMUTABLE_RELEASE_HISTORY'; end if;
  if tg_op='INSERT' then
    if new.status <> 'draft' then raise exception 'RELEASE_MUST_START_DRAFT'; end if;
    return new;
  end if;
  if new.id is distinct from old.id or new.release_number is distinct from old.release_number
    or new.created_at is distinct from old.created_at or new.dataset_hash is distinct from old.dataset_hash
    or new.expected_previous_release_id is distinct from old.expected_previous_release_id then
    raise exception 'IMMUTABLE_RELEASE_IDENTITY';
  end if;
  if old.status <> 'draft' and (to_jsonb(new)-'status') is distinct from (to_jsonb(old)-'status') then
    raise exception 'IMMUTABLE_RELEASE_APPROVAL';
  end if;
  if not ((old.status='draft' and new.status in ('draft','approved'))
    or (old.status='approved' and new.status in ('approved','published'))
    or (old.status='published' and new.status in ('published','superseded'))
    or (old.status='superseded' and new.status in ('superseded','published'))) then
    raise exception 'INVALID_RELEASE_TRANSITION';
  end if;
  if old.status='draft' and new.status='approved' then
    if coalesce(length(trim(new.approved_by)),0)=0 or coalesce(length(trim(new.approval_note)),0)=0 or new.approved_at is null then
      raise exception 'EXPLICIT_APPROVAL_REQUIRED';
    end if;
    gate := padlownia.release_gate(new.id);
    if not (gate->>'allowed')::boolean then raise exception 'RELEASE_GATE_BLOCKED'; end if;
    new.quality_report := gate;
  end if;
  return new;
end $$;
create trigger protect_release_lifecycle before insert or update or delete on padlownia.catalog_releases
for each row execute function padlownia.protect_release_lifecycle();

create function padlownia.approve_release(target uuid, actor text, note text) returns jsonb
language plpgsql security definer set search_path = pg_catalog, padlownia as $$
declare gate jsonb; target_status text;
begin
  if coalesce(length(trim(actor)),0)=0 or coalesce(length(trim(note)),0)=0 then raise exception 'EXPLICIT_APPROVAL_REQUIRED'; end if;
  select status into target_status from padlownia.catalog_releases where id=target for update;
  if target_status is null or target_status<>'draft' then raise exception 'RELEASE_NOT_DRAFT'; end if;
  gate := padlownia.release_gate(target);
  if not (gate->>'allowed')::boolean then raise exception 'RELEASE_GATE_BLOCKED'; end if;
  update padlownia.catalog_releases set status='approved',approved_by=actor,approval_note=note,approved_at=now(),quality_report=gate where id=target;
  return gate;
end $$;

revoke insert,update,delete on padlownia.catalog_state,padlownia.publication_events,padlownia.catalog_releases from padlownia_worker,service_role;
grant insert(dataset_hash,expected_previous_release_id) on padlownia.catalog_releases to padlownia_worker,service_role;
-- PostgreSQL requires an UPDATE privilege for row locking. The lifecycle trigger
-- rejects changes to this field; it is granted solely to lock a draft for rebuild.
grant update(dataset_hash) on padlownia.catalog_releases to padlownia_worker,service_role;
revoke all on function padlownia.approve_release(uuid,text,text) from public,anon,authenticated,padlownia_reader;
grant execute on function padlownia.approve_release(uuid,text,text) to padlownia_worker,service_role;
revoke all on function padlownia.protect_release_lifecycle() from public,anon,authenticated,padlownia_reader;
