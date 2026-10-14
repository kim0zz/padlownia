-- A reviewed parser correction retires only an unpublished processing run.
-- Original snapshots, outputs and their review evidence remain in place.
alter table padlownia.ingestion_runs drop constraint ingestion_runs_status_check;
alter table padlownia.ingestion_runs add constraint ingestion_runs_status_check
  check(status in ('processing','staged','review_required','partial','failed_retryable','failed_terminal','superseded'));
alter table padlownia.ingestion_runs add column superseded_by_run_id uuid references padlownia.ingestion_runs;
alter table padlownia.ingestion_runs add constraint superseded_run_reference
  check((status='superseded') = (superseded_by_run_id is not null));
create index ingestion_runs_successor on padlownia.ingestion_runs(superseded_by_run_id) where superseded_by_run_id is not null;
create function padlownia.protect_run_supersession() returns trigger language plpgsql
set search_path=pg_catalog,padlownia as $$
begin
  if old.superseded_by_run_id is not null then raise exception 'SUPERSEDED_RUN_IMMUTABLE'; end if;
  if new.superseded_by_run_id is not null then
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
create trigger protect_run_supersession before update on padlownia.ingestion_runs
for each row execute function padlownia.protect_run_supersession();
revoke all on function padlownia.protect_run_supersession() from public,anon,authenticated,padlownia_reader;
