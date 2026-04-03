create or replace view public.v_council_scoreboard as
with latest_targets as (
  select distinct on (ht.council_id)
    ht.council_id,
    ht.target_value,
    ht.resident_population,
    ht.number_of_homes,
    ht.average_household_size,
    ht.urban_tree_canopy_pct,
    ht.high_heat_vulnerability_pct,
    ht.observed_at
  from public.housing_targets ht
  order by ht.council_id, ht.observed_at desc
), latest_activity as (
  select distinct on (cac.council_id)
    cac.council_id,
    cac.total_count,
    cac.recent_count,
    cac.recent_window_start,
    cac.observed_at
  from public.council_activity_counts cac
  order by cac.council_id, cac.observed_at desc
), proposal_counts as (
  select
    pp.council_id,
    count(*) filter (where pp.stage in ('under_assessment', 'pre_exhibition', 'on_exhibition', 'finalisation')) as active_pipeline_count,
    count(*) filter (where pp.stage = 'made') as made_count,
    count(*) filter (where pp.stage = 'withdrawn') as withdrawn_count
  from public.planning_proposals pp
  group by pp.council_id
)
select
  c.id as council_id,
  c.canonical_name as council_name,
  c.region_group,
  lt.target_value,
  lt.resident_population,
  lt.number_of_homes,
  lt.average_household_size,
  lt.urban_tree_canopy_pct,
  lt.high_heat_vulnerability_pct,
  la.total_count as application_total_count,
  la.recent_count as application_recent_count,
  pc.active_pipeline_count,
  pc.made_count,
  pc.withdrawn_count,
  lt.observed_at as targets_observed_at,
  la.observed_at as activity_observed_at
from public.councils c
left join latest_targets lt on lt.council_id = c.id
left join latest_activity la on la.council_id = c.id
left join proposal_counts pc on pc.council_id = c.id;

create or replace view public.v_policy_pipeline as
select
  pp.stage,
  pp.stage_rank,
  count(*) as proposal_count,
  count(distinct pp.council_id) as council_count,
  min(pp.last_seen_at) as earliest_seen_at,
  max(pp.last_seen_at) as latest_seen_at
from public.planning_proposals pp
group by pp.stage, pp.stage_rank
order by pp.stage_rank nulls last, pp.stage;

create or replace view public.v_target_pressure_vs_activity as
select
  vcs.council_id,
  vcs.council_name,
  vcs.region_group,
  vcs.target_value,
  vcs.number_of_homes,
  vcs.application_recent_count,
  vcs.urban_tree_canopy_pct,
  vcs.high_heat_vulnerability_pct,
  case
    when vcs.number_of_homes is not null and vcs.number_of_homes > 0 and vcs.target_value is not null
      then round((vcs.target_value::numeric / vcs.number_of_homes::numeric) * 100, 2)
    else null
  end as target_as_pct_of_existing_homes,
  case
    when vcs.target_value is not null and vcs.target_value > 0 and vcs.application_recent_count is not null
      then round(vcs.application_recent_count::numeric / vcs.target_value::numeric, 2)
    else null
  end as recent_activity_to_target_ratio
from public.v_council_scoreboard vcs;

create or replace view public.v_sydney_proposal_watchlist as
select
  pp.id,
  pp.title,
  pp.stage,
  pp.stage_rank,
  c.canonical_name as council_name,
  pp.location_text,
  pp.source_url,
  pp.summary,
  pp.analyst_note,
  pp.last_seen_at
from public.planning_proposals pp
left join public.councils c on c.id = pp.council_id
where c.region_group = 'Greater Sydney'
order by pp.stage_rank nulls last, pp.last_seen_at desc, pp.title;

create or replace view public.v_recent_application_ranking as
select
  c.canonical_name as council_name,
  cac.total_count,
  cac.recent_count,
  cac.recent_window_start,
  cac.observed_at
from public.council_activity_counts cac
join public.councils c on c.id = cac.council_id
where cac.observed_at = (
  select max(cac2.observed_at)
  from public.council_activity_counts cac2
  where cac2.council_id = cac.council_id
)
order by cac.recent_count desc nulls last, cac.total_count desc nulls last;
