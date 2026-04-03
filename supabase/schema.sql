begin;

create extension if not exists pgcrypto;

create table if not exists public.ingest_runs (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_scope text,
  run_status text not null default 'started',
  rows_observed integer,
  notes text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.source_snapshots (
  id uuid primary key default gen_random_uuid(),
  ingest_run_id uuid references public.ingest_runs(id) on delete set null,
  source_name text not null,
  source_scope text,
  snapshot_kind text not null,
  storage_path text,
  source_url text,
  observed_at timestamptz not null default now(),
  notes text
);

create table if not exists public.councils (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null unique,
  display_name text,
  region_group text,
  state_code text not null default 'NSW',
  is_focus boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.precincts (
  id uuid primary key default gen_random_uuid(),
  precinct_code text unique,
  name text not null,
  precinct_type text not null,
  primary_council_id uuid references public.councils(id) on delete set null,
  policy_theme text,
  source_url text,
  watch_priority text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.housing_targets (
  id uuid primary key default gen_random_uuid(),
  record_key text unique,
  council_id uuid not null references public.councils(id) on delete cascade,
  source_name text not null default 'Housing Targets',
  target_period text,
  target_value_raw text not null,
  target_value integer,
  completion_or_progress_raw text,
  resident_population integer,
  number_of_homes integer,
  average_household_size numeric(6,2),
  urban_tree_canopy_pct numeric(6,2),
  high_heat_vulnerability_pct numeric(6,2),
  moderate_heat_vulnerability_pct numeric(6,2),
  low_heat_vulnerability_pct numeric(6,2),
  source_url text not null,
  source_updated_date date,
  observed_at date not null,
  notes text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (council_id, observed_at)
);

create index if not exists housing_targets_council_idx
  on public.housing_targets (council_id, observed_at desc);

create table if not exists public.planning_proposals (
  id uuid primary key default gen_random_uuid(),
  proposal_key text unique,
  source_name text not null default 'Planning Proposals Online',
  proposal_number text,
  title text not null,
  stage text not null,
  stage_rank integer,
  council_id uuid references public.councils(id) on delete set null,
  precinct_id uuid references public.precincts(id) on delete set null,
  location_text text,
  source_url text not null,
  summary text,
  analyst_note text,
  first_seen_at date,
  last_seen_at date not null,
  is_active boolean not null default true,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists planning_proposals_stage_idx
  on public.planning_proposals (stage, stage_rank, last_seen_at desc);

create index if not exists planning_proposals_council_idx
  on public.planning_proposals (council_id, last_seen_at desc);

create table if not exists public.planning_proposal_stage_history (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.planning_proposals(id) on delete cascade,
  stage text not null,
  stage_rank integer,
  observed_at date not null,
  source_url text,
  notes text,
  created_at timestamptz not null default now(),
  unique (proposal_id, stage, observed_at)
);

create table if not exists public.application_signals (
  id uuid primary key default gen_random_uuid(),
  app_key text unique,
  source_name text not null,
  tracker_scope text not null,
  portal_app_number text,
  project_name text,
  council_id uuid references public.councils(id) on delete set null,
  precinct_id uuid references public.precincts(id) on delete set null,
  application_type text,
  development_type text,
  status text,
  lodgement_date date,
  determination_date date,
  location_text text,
  latitude numeric(12,8),
  longitude numeric(12,8),
  source_url text not null,
  observed_at date not null,
  signal_weight integer not null default 1,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists application_signals_council_idx
  on public.application_signals (council_id, observed_at desc);

create index if not exists application_signals_lodgement_idx
  on public.application_signals (lodgement_date desc nulls last);

create table if not exists public.constraints (
  id uuid primary key default gen_random_uuid(),
  constraint_key text unique,
  precinct_id uuid references public.precincts(id) on delete cascade,
  council_id uuid references public.councils(id) on delete set null,
  constraint_type text not null,
  severity text not null,
  source_name text not null,
  source_url text,
  observed_at date not null,
  notes text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists constraints_precinct_idx
  on public.constraints (precinct_id, severity, constraint_type);

create index if not exists constraints_council_idx
  on public.constraints (council_id, observed_at desc);

create table if not exists public.council_activity_counts (
  id uuid primary key default gen_random_uuid(),
  source_name text not null default 'DAApplicationTracker API',
  council_id uuid not null references public.councils(id) on delete cascade,
  status_scope text not null default 'ALL',
  total_count integer,
  recent_count integer,
  recent_window_start date,
  observed_at date not null,
  notes text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  unique (council_id, status_scope, recent_window_start, observed_at)
);

create index if not exists council_activity_counts_council_idx
  on public.council_activity_counts (council_id, observed_at desc);

create table if not exists public.opportunity_items (
  id uuid primary key default gen_random_uuid(),
  item_key text unique,
  item_name text not null,
  geography_level text not null,
  council_id uuid references public.councils(id) on delete set null,
  precinct_id uuid references public.precincts(id) on delete set null,
  trigger_summary text not null,
  policy_score integer,
  capacity_score integer,
  friction_score integer,
  timing_score integer,
  opportunity_rating text,
  analyst_confidence text,
  recommended_action text,
  workflow_status text not null default 'active',
  source_bundle text,
  memo_link text,
  last_reviewed_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_councils_updated_at on public.councils;
create trigger trg_councils_updated_at
before update on public.councils
for each row execute function public.set_updated_at();

drop trigger if exists trg_precincts_updated_at on public.precincts;
create trigger trg_precincts_updated_at
before update on public.precincts
for each row execute function public.set_updated_at();

drop trigger if exists trg_housing_targets_updated_at on public.housing_targets;
create trigger trg_housing_targets_updated_at
before update on public.housing_targets
for each row execute function public.set_updated_at();

drop trigger if exists trg_planning_proposals_updated_at on public.planning_proposals;
create trigger trg_planning_proposals_updated_at
before update on public.planning_proposals
for each row execute function public.set_updated_at();

drop trigger if exists trg_application_signals_updated_at on public.application_signals;
create trigger trg_application_signals_updated_at
before update on public.application_signals
for each row execute function public.set_updated_at();

drop trigger if exists trg_constraints_updated_at on public.constraints;
create trigger trg_constraints_updated_at
before update on public.constraints
for each row execute function public.set_updated_at();

drop trigger if exists trg_opportunity_items_updated_at on public.opportunity_items;
create trigger trg_opportunity_items_updated_at
before update on public.opportunity_items
for each row execute function public.set_updated_at();

commit;
