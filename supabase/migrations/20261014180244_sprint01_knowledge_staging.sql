-- Private, unreviewed source manifest only. No text/chunks, embeddings or public reader.
create table padlownia.knowledge_assets (
  id uuid primary key default gen_random_uuid(),
  source_code text not null references padlownia.data_sources(code) check(source_code = 'padelhow'),
  sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
  byte_count integer not null check(byte_count between 1 and 52428800),
  parser_version text not null check(parser_version ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$'),
  format text not null check(format in ('text','json')),
  retrieved_at timestamptz not null,
  storage_bucket text not null check(storage_bucket = 'review-originals'),
  storage_path text not null,
  storage_verified boolean not null check(storage_verified),
  source_metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(source_metadata) = 'object' and octet_length(source_metadata::text) <= 65536),
  document_count integer not null check(document_count between 1 and 50000),
  manifest_sha256 text not null check(manifest_sha256 ~ '^[a-f0-9]{64}$'),
  rights_state text not null default 'private_staging_unreviewed' check(rights_state = 'private_staging_unreviewed'),
  created_at timestamptz not null default now(),
  unique(source_code,sha256,parser_version),
  check(storage_path = source_code || '/' || sha256 || case format when 'text' then '.txt' else '.json' end)
);
create table padlownia.knowledge_documents (
  asset_id uuid not null references padlownia.knowledge_assets,
  ordinal integer not null check(ordinal >= 0),
  source_path text check(source_path is null or length(source_path) between 1 and 4096),
  url text check(url is null or (url ~ '^https://padel[.]how/' and length(url) <= 2048)),
  title text not null check(length(title) between 1 and 2048),
  locale text check(locale is null or (locale ~ '^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$' and length(locale) <= 35)),
  kind text not null check(kind ~ '^[a-z][a-z0-9_]{0,63}$'),
  sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
  character_start integer not null check(character_start >= 0),
  character_end integer not null check(character_end > character_start),
  product_slugs text[] not null default '{}',
  issues text[] not null default '{}',
  primary key(asset_id,ordinal),
  check(cardinality(product_slugs) <= 100 and array_position(product_slugs,null) is null
    and (cardinality(product_slugs) = 0 or array_to_string(product_slugs,'|') ~ '^[a-z0-9-]+(\|[a-z0-9-]+)*$')),
  check(cardinality(issues) <= 100 and array_position(issues,null) is null
    and (cardinality(issues) = 0 or array_to_string(issues,'|') ~ '^[a-z0-9_]+(\|[a-z0-9_]+)*$'))
);

-- One deferred check per new asset rejects partial manifests at COMMIT. The count,
-- unique ordinals and INSERT bounds also prevent appending to a completed manifest.
create function padlownia.check_knowledge_manifest() returns trigger language plpgsql
set search_path = pg_catalog, padlownia as $$
begin
  if (select count(*) from padlownia.knowledge_documents where asset_id=new.id) <> new.document_count then
    raise exception 'INCOMPLETE_KNOWLEDGE_MANIFEST';
  end if;
  if exists(select 1 from (
    select character_start,lag(character_end) over(order by ordinal) previous_end
    from padlownia.knowledge_documents where asset_id=new.id
  ) ordered where character_start < previous_end) then
    raise exception 'OVERLAPPING_KNOWLEDGE_DOCUMENTS';
  end if;
  return null;
end $$;
create constraint trigger complete_knowledge_manifest after insert on padlownia.knowledge_assets
deferrable initially deferred for each row execute function padlownia.check_knowledge_manifest();

create function padlownia.check_knowledge_document() returns trigger language plpgsql
set search_path = pg_catalog, padlownia as $$
declare asset padlownia.knowledge_assets;
begin
  select * into asset from padlownia.knowledge_assets where id=new.asset_id;
  if asset.id is null or new.ordinal >= asset.document_count or new.character_end > asset.byte_count then
    raise exception 'INVALID_KNOWLEDGE_DOCUMENT_BOUNDS';
  end if;
  return new;
end $$;
create trigger bounded_knowledge_document before insert on padlownia.knowledge_documents
for each row execute function padlownia.check_knowledge_document();
create trigger immutable_knowledge_asset before update or delete on padlownia.knowledge_assets
for each row execute function padlownia.reject_history_mutation();
create trigger immutable_knowledge_document before update or delete on padlownia.knowledge_documents
for each row execute function padlownia.reject_history_mutation();

alter table padlownia.knowledge_assets enable row level security;
alter table padlownia.knowledge_documents enable row level security;
create policy knowledge_assets_read on padlownia.knowledge_assets for select to padlownia_worker using(true);
create policy knowledge_assets_insert on padlownia.knowledge_assets for insert to padlownia_worker with check(true);
create policy knowledge_documents_read on padlownia.knowledge_documents for select to padlownia_worker using(true);
create policy knowledge_documents_insert on padlownia.knowledge_documents for insert to padlownia_worker with check(true);
revoke all on padlownia.knowledge_assets,padlownia.knowledge_documents from public,anon,authenticated,padlownia_reader;
grant select,insert on padlownia.knowledge_assets,padlownia.knowledge_documents to padlownia_worker,service_role;
revoke all on function padlownia.check_knowledge_manifest(),padlownia.check_knowledge_document() from public,anon,authenticated,padlownia_reader;
