-- Supporting indexes for release gates, evidence traversal and foreign keys.
-- The catalog_state singleton intentionally has no extra active_release_id index:
-- its CHECK + primary key permit at most one row, making an index redundant.
create index catalog_releases_previous_idx on padlownia.catalog_releases(expected_previous_release_id);
create index ingestion_runs_snapshot_source_idx on padlownia.ingestion_runs(snapshot_id,source_id);
create index ingestion_runs_source_idx on padlownia.ingestion_runs(source_id);
create index projection_specs_observation_idx on padlownia.projection_specs(observation_id);
create index publication_events_previous_idx on padlownia.publication_events(previous_release_id);
create index publication_events_release_idx on padlownia.publication_events(release_id);
create index racket_projections_racket_idx on padlownia.racket_projections(racket_id);
create index rackets_family_idx on padlownia.rackets(family_id);
create index record_results_run_snapshot_idx on padlownia.record_results(run_id,snapshot_id);
create index record_results_record_snapshot_idx on padlownia.record_results(source_record_id,snapshot_id);
create index release_sources_run_idx on padlownia.release_sources(run_id);
create index release_sources_source_idx on padlownia.release_sources(source_id);
create index review_queue_result_idx on padlownia.review_queue(result_id);
create index review_queue_run_idx on padlownia.review_queue(run_id);
create index run_events_run_idx on padlownia.run_events(run_id);
create index source_entity_matches_racket_idx on padlownia.source_entity_matches(racket_id);
