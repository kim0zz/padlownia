-- Environment marker is inserted separately only after project identity verification.
-- Local PGlite inserts the explicit 'local' marker; a fresh cloud DB stays unmarked.
create table padlownia.environment_identity (
  singleton boolean primary key default true check(singleton),
  environment text not null check(environment='development'),
  project_ref text not null check(project_ref='local' or project_ref ~ '^[a-z0-9]{20}$'),
  created_at timestamptz not null default now()
);
alter table padlownia.environment_identity enable row level security;
revoke all on padlownia.environment_identity from public,anon,authenticated,padlownia_worker,padlownia_reader,service_role;
grant select on padlownia.environment_identity to padlownia_worker,padlownia_reader;
create policy environment_identity_read on padlownia.environment_identity for select
to padlownia_worker,padlownia_reader using(true);
create trigger immutable_environment_identity before update or delete on padlownia.environment_identity
for each row execute function padlownia.reject_history_mutation();

-- Fail on colliding names rather than changing unverified existing credentials.
-- No passwords or secrets belong in this migration. Trusted provisioning enables
-- LOGIN only after safely setting separate generated secrets outside the repo.
create role padlownia_web nologin inherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role padlownia_ingest nologin inherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant padlownia_reader to padlownia_web;
grant padlownia_worker to padlownia_ingest;
do $$ begin
  execute format('grant connect on database %I to padlownia_web,padlownia_ingest',current_database());
end $$;
