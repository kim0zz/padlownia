-- Only apply to the verified development project. Never reset a remote database.
create schema if not exists padlownia;
revoke all on schema padlownia from public, anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'padlownia_reader') then
    create role padlownia_reader nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'padlownia_worker') then
    create role padlownia_worker nologin;
  end if;
end $$;
grant usage on schema padlownia to padlownia_reader, padlownia_worker, service_role;

create table padlownia.data_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  base_url text not null check (base_url ~ '^https://'),
  rights_status text not null default 'pending' check (rights_status in ('pending','approved','disallowed')),
  catalogue_display_allowed boolean not null default false,
  permission_reference text,
  permission_scope jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  check (not catalogue_display_allowed or (rights_status = 'approved' and length(permission_reference) > 0))
);
insert into padlownia.data_sources(code,display_name,base_url) values
  ('padeltrue','PadelTrue','https://padeltrue.com'),
  ('padelhow','padel.how','https://padel.how');

create table padlownia.source_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references padlownia.data_sources,
  retrieved_at timestamptz not null,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  storage_bucket text not null check (storage_bucket in ('source-snapshots','review-originals')),
  storage_path text not null check (length(storage_path) > 0 and storage_path not like '%..%'),
  storage_verified boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  unique(source_id,sha256),
  unique(id,source_id)
);
create table padlownia.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references padlownia.data_sources,
  snapshot_id uuid not null,
  parser_version text not null,
  normalizer_version text not null,
  matching_version text not null,
  idempotency_key text not null unique,
  status text not null default 'processing' check(status in ('processing','staged','review_required','partial','failed_retryable','failed_terminal')),
  declared_count integer check(declared_count >= 0),
  actual_count integer not null check(actual_count >= 0),
  metrics jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key(snapshot_id,source_id) references padlownia.source_snapshots(id,source_id),
  unique(id,snapshot_id)
);
create table padlownia.run_events (
  id bigint generated always as identity primary key,
  run_id uuid not null references padlownia.ingestion_runs,
  stage text not null,
  code text not null,
  created_at timestamptz not null default now()
);
-- Input index retains duplicated upstream IDs instead of silently dropping raw rows.
create table padlownia.source_records (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references padlownia.source_snapshots,
  input_index integer not null check(input_index >= 0),
  external_id text not null,
  external_id_scope text not null check(external_id_scope in ('source','snapshot')),
  source_url text check(source_url is null or source_url ~ '^https?://'),
  raw_payload jsonb not null,
  payload_sha256 text not null check(payload_sha256 ~ '^[a-f0-9]{64}$'),
  unique(snapshot_id,input_index),
  unique(id,snapshot_id)
);
create index source_records_external on padlownia.source_records(snapshot_id,external_id);
create table padlownia.racket_families (
  id uuid primary key default gen_random_uuid(),
  brand_key text not null,
  family_key text not null,
  display_name text not null,
  unique(brand_key,family_key)
);
create table padlownia.rackets (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references padlownia.racket_families,
  identity_key text not null unique,
  brand_key text not null,
  model_key text not null,
  variant_key text not null,
  model_year integer check(model_year between 1980 and 2100),
  brand text not null check(length(brand)>0),
  model text not null check(length(model)>0),
  normalized_identity jsonb not null,
  unique nulls not distinct(brand_key,model_key,variant_key,model_year)
);
create table padlownia.record_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  source_record_id uuid not null,
  snapshot_id uuid not null,
  status text not null check(status in ('valid','needs_review','invalid')),
  issues jsonb not null default '[]'::jsonb,
  unique(run_id,source_record_id),
  foreign key(run_id,snapshot_id) references padlownia.ingestion_runs(id,snapshot_id),
  foreign key(source_record_id,snapshot_id) references padlownia.source_records(id,snapshot_id)
);
create table padlownia.source_entity_matches (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null unique references padlownia.record_results,
  racket_id uuid references padlownia.rackets,
  decision text not null check(decision in ('auto_accepted','new_identity','needs_review','manually_accepted','rejected')),
  candidate_ids jsonb not null default '[]'::jsonb,
  reason_codes jsonb not null default '[]'::jsonb,
  rule_version text not null,
  reviewed_by text,
  reviewed_at timestamptz,
  check(decision not in ('auto_accepted','new_identity','manually_accepted') or racket_id is not null)
);
create table padlownia.spec_observations (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references padlownia.record_results,
  ordinal integer not null,
  attribute_key text not null,
  raw_value jsonb not null,
  normalized_text text,
  numeric_value numeric,
  value_min numeric,
  value_max numeric,
  unit text,
  measurement_context jsonb not null default '{}'::jsonb,
  claim_type text not null check(claim_type in ('manufacturer_declared','retailer_claim','measured_specimen','editorial_assessment','unknown')),
  validation_status text not null check(validation_status in ('valid','unknown','invalid')),
  attribution jsonb,
  evidence_path text not null check(length(evidence_path)>0),
  issues jsonb not null default '[]'::jsonb,
  unique(result_id,ordinal),
  check(value_min is null or value_max is null or value_min <= value_max)
);
create table padlownia.source_ratings (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references padlownia.record_results,
  ordinal integer not null,
  dimension_key text not null,
  raw_value jsonb not null,
  numeric_score numeric,
  scale_min numeric,
  scale_max numeric,
  methodology text not null,
  rating_kind text not null check(rating_kind in ('editorial','rule_derived','measured','unknown')),
  validation_status text not null check(validation_status in ('valid','unknown','invalid')),
  evidence_path text not null,
  issues jsonb not null default '[]'::jsonb,
  unique(result_id,ordinal),
  check(scale_min is null or scale_max is null or scale_min < scale_max),
  check(numeric_score is null or validation_status <> 'valid' or
    (numeric_score >= scale_min and numeric_score <= scale_max))
);
create table padlownia.review_queue (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references padlownia.ingestion_runs,
  result_id uuid references padlownia.record_results,
  reason_code text not null,
  status text not null default 'pending' check(status in ('pending','accepted','rejected')),
  reviewer text,
  resolution_note text,
  resolved_at timestamptz,
  check(status = 'pending' or (reviewer is not null and resolved_at is not null and resolution_note is not null))
);
create table padlownia.catalog_releases (
  id uuid primary key default gen_random_uuid(),
  release_number bigint generated always as identity unique,
  status text not null default 'draft' check(status in ('draft','approved','published','superseded')),
  created_at timestamptz not null default now(),
  approved_by text,
  approval_note text,
  approved_at timestamptz,
  quality_report jsonb not null default '{}'::jsonb,
  dataset_hash text not null,
  expected_previous_release_id uuid references padlownia.catalog_releases
);
create table padlownia.release_sources (
  release_id uuid not null references padlownia.catalog_releases,
  source_id uuid not null references padlownia.data_sources,
  run_id uuid not null references padlownia.ingestion_runs,
  primary key(release_id,source_id),
  unique(release_id,run_id)
);
create table padlownia.racket_projections (
  release_id uuid not null references padlownia.catalog_releases,
  racket_id uuid not null references padlownia.rackets,
  shape text,
  weight_min_g numeric,
  weight_max_g numeric,
  balance_cm numeric,
  core_normalized text,
  surface_normalized text,
  extra_attributes jsonb not null default '{}'::jsonb,
  conflict_flags jsonb not null default '[]'::jsonb,
  primary key(release_id,racket_id)
);
create table padlownia.projection_specs (
  release_id uuid not null,
  racket_id uuid not null,
  attribute_key text not null,
  observation_id uuid not null references padlownia.spec_observations,
  primary key(release_id,racket_id,attribute_key),
  foreign key(release_id,racket_id) references padlownia.racket_projections
);
create table padlownia.catalog_state (
  singleton boolean primary key default true check(singleton),
  active_release_id uuid references padlownia.catalog_releases
);
insert into padlownia.catalog_state(singleton) values(true);
create table padlownia.publication_events (
  id bigint generated always as identity primary key,
  release_id uuid not null references padlownia.catalog_releases,
  previous_release_id uuid references padlownia.catalog_releases,
  action text not null check(action in ('publish','rollback')),
  actor text not null,
  created_at timestamptz not null default now()
);

-- Immutable source versions and processing outputs. Reprocessing creates a new run.
create function padlownia.reject_history_mutation() returns trigger language plpgsql
set search_path = pg_catalog as $$ begin
  raise exception 'IMMUTABLE_HISTORY';
end $$;
do $$ declare t text; begin
  foreach t in array array['source_snapshots','source_records','record_results','spec_observations','source_ratings','run_events','publication_events','rackets'] loop
    execute format('create trigger immutable_history before update or delete on padlownia.%I for each row execute function padlownia.reject_history_mutation()',t);
  end loop;
end $$;

create function padlownia.protect_release_content() returns trigger language plpgsql
set search_path = pg_catalog, padlownia as $$
declare target uuid;
begin
  target := case when tg_op = 'DELETE' then old.release_id else new.release_id end;
  if exists(select 1 from padlownia.catalog_releases where id = target and status <> 'draft') then
    raise exception 'IMMUTABLE_RELEASE';
  end if;
  if tg_op = 'UPDATE' and exists(select 1 from padlownia.catalog_releases where id = old.release_id and status <> 'draft') then
    raise exception 'IMMUTABLE_RELEASE';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger protect_release_sources before insert or update or delete on padlownia.release_sources
for each row execute function padlownia.protect_release_content();
create trigger protect_projection before insert or update or delete on padlownia.racket_projections
for each row execute function padlownia.protect_release_content();
create trigger protect_projection_specs before insert or update or delete on padlownia.projection_specs
for each row execute function padlownia.protect_release_content();

-- Every operational/raw table denies browser access. Worker access is explicit.
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname = 'padlownia' loop
    execute format('alter table padlownia.%I enable row level security', t.tablename);
    execute format('create policy worker_access on padlownia.%I for all to padlownia_worker using (true) with check (true)',t.tablename);
  end loop;
end $$;
revoke all on all tables in schema padlownia from public, anon, authenticated, padlownia_reader;
revoke all on all functions in schema padlownia from public, anon, authenticated, padlownia_reader;
grant select,insert,update,delete on all tables in schema padlownia to padlownia_worker,service_role;
grant usage,select on all sequences in schema padlownia to padlownia_worker,service_role;
alter default privileges in schema padlownia revoke execute on functions from public;

-- New buckets are private. Existing colliding public buckets fail rather than being silently changed.
do $$ begin
  if exists(select 1 from storage.buckets where id in ('source-snapshots','review-originals') and public) then
    raise exception 'EXISTING_BUCKET_IS_PUBLIC';
  end if;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
  ('source-snapshots','source-snapshots',false,52428800,array['application/json','text/plain']),
  ('review-originals','review-originals',false,52428800,array['text/html','text/markdown','application/json','text/plain'])
on conflict(id) do nothing;
-- Restrictive policies also guard against permissive policies created by other apps.
create policy padlownia_private_select on storage.objects as restrictive for select to anon,authenticated
using (bucket_id not in ('source-snapshots','review-originals'));
create policy padlownia_private_insert on storage.objects as restrictive for insert to anon,authenticated
with check (bucket_id not in ('source-snapshots','review-originals'));
create policy padlownia_private_update on storage.objects as restrictive for update to anon,authenticated
using (bucket_id not in ('source-snapshots','review-originals')) with check (bucket_id not in ('source-snapshots','review-originals'));
create policy padlownia_private_delete on storage.objects as restrictive for delete to anon,authenticated
using (bucket_id not in ('source-snapshots','review-originals'));
