drop view if exists public.v_site_screening_latest;
drop view if exists public.v_site_constraints_latest;
drop view if exists public.v_site_controls_latest;
drop view if exists public.v_site_candidates_latest;
drop view if exists public.v_precinct_map_points;
drop view if exists public.v_precinct_shortlist;
drop view if exists public.v_precinct_signal_summary;
drop view if exists public.v_precinct_constraint_summary;

create or replace view public.v_precinct_constraint_summary as
select
  c.precinct_id,
  count(*) as constraint_count,
  count(*) filter (where c.severity = 'high') as high_constraint_count,
  count(*) filter (where c.severity = 'medium') as medium_constraint_count,
  count(*) filter (where c.severity = 'low') as low_constraint_count,
  string_agg(
    c.constraint_type || ' (' || c.severity || ')',
    ', ' order by
      case c.severity when 'high' then 1 when 'medium' then 2 else 3 end,
      c.constraint_type
  ) as constraint_summary
from public.constraints c
where c.precinct_id is not null
group by c.precinct_id;

create or replace view public.v_precinct_signal_summary as
with latest_targets as (
  select distinct on (ht.council_id)
    ht.council_id,
    ht.target_value,
    ht.urban_tree_canopy_pct,
    ht.high_heat_vulnerability_pct,
    ht.average_household_size
  from public.housing_targets ht
  order by ht.council_id, ht.observed_at desc
), proposal_counts as (
  select
    pp.precinct_id,
    count(*) filter (where pp.stage in ('under_assessment', 'pre_exhibition', 'on_exhibition', 'finalisation')) as active_pipeline_count,
    count(*) filter (where pp.stage = 'made') as made_count,
    count(*) filter (where pp.stage = 'withdrawn') as withdrawn_count,
    max(pp.last_seen_at) as latest_policy_seen_at
  from public.planning_proposals pp
  where pp.precinct_id is not null
  group by pp.precinct_id
), application_counts as (
  select
    a.precinct_id,
    date '2025-01-01' as recent_application_window_start,
    count(*) filter (where a.tracker_scope = 'applications') as mapped_application_count,
    count(*) filter (where a.tracker_scope = 'applications' and coalesce(a.lodgement_date, a.observed_at) >= date '2025-01-01') as recent_application_count,
    count(*) filter (
      where coalesce(a.lodgement_date, a.observed_at) >= date '2025-01-01'
        and (
          a.tracker_scope = 'state_significant'
          or lower(coalesce(a.application_type, '')) like '%state significant%'
          or lower(coalesce(a.application_type, '')) like '%ssd%'
        )
    ) as recent_ssd_count,
    count(*) filter (
      where a.tracker_scope = 'applications'
        and coalesce(a.lodgement_date, a.observed_at) >= date '2025-01-01'
        and (
          lower(coalesce(a.application_type, '')) like '%complying development certificate%'
          or lower(coalesce(a.application_type, '')) like '%cdc%'
        )
    ) as recent_cdc_count,
    count(*) filter (
      where a.tracker_scope = 'applications'
        and coalesce(a.lodgement_date, a.observed_at) >= date '2025-01-01'
        and lower(coalesce(a.application_type, '')) like '%modification%'
    ) as recent_modification_count,
    count(*) filter (
      where a.tracker_scope = 'applications'
        and coalesce(a.lodgement_date, a.observed_at) >= date '2025-01-01'
        and lower(coalesce(a.application_type, '')) like '%development application%'
        and lower(coalesce(a.application_type, '')) not like '%complying development certificate%'
        and lower(coalesce(a.application_type, '')) not like '%state significant%'
    ) as recent_da_count,
    count(*) filter (
      where a.tracker_scope = 'applications'
        and coalesce(a.lodgement_date, a.observed_at) >= date '2025-01-01'
        and lower(coalesce(a.application_type, '')) not like '%development application%'
        and lower(coalesce(a.application_type, '')) not like '%complying development certificate%'
        and lower(coalesce(a.application_type, '')) not like '%cdc%'
        and lower(coalesce(a.application_type, '')) not like '%modification%'
        and lower(coalesce(a.application_type, '')) not like '%state significant%'
        and lower(coalesce(a.application_type, '')) not like '%ssd%'
    ) as recent_other_count,
    count(*) filter (where a.tracker_scope = 'state_significant') as state_significant_count,
    max(a.observed_at) as latest_activity_seen_at
  from public.application_signals a
  where a.precinct_id is not null
  group by a.precinct_id
)
select
  p.id as precinct_id,
  p.precinct_code,
  p.name as precinct_name,
  p.precinct_type,
  p.policy_theme,
  p.watch_priority,
  c.canonical_name as council_name,
  lt.target_value as council_target_value,
  lt.urban_tree_canopy_pct,
  lt.high_heat_vulnerability_pct,
  lt.average_household_size,
  coalesce(pc.active_pipeline_count, 0) as active_pipeline_count,
  coalesce(pc.made_count, 0) as made_count,
  coalesce(pc.withdrawn_count, 0) as withdrawn_count,
  coalesce(ac.mapped_application_count, 0) as mapped_application_count,
  ac.recent_application_window_start,
  coalesce(ac.recent_application_count, 0) as recent_application_count,
  coalesce(ac.recent_da_count, 0) as recent_da_count,
  coalesce(ac.recent_cdc_count, 0) as recent_cdc_count,
  coalesce(ac.recent_ssd_count, 0) as recent_ssd_count,
  coalesce(ac.recent_modification_count, 0) as recent_modification_count,
  coalesce(ac.recent_other_count, 0) as recent_other_count,
  coalesce(ac.state_significant_count, 0) as state_significant_count,
  coalesce(cc.constraint_count, 0) as constraint_count,
  coalesce(cc.high_constraint_count, 0) as high_constraint_count,
  coalesce(cc.medium_constraint_count, 0) as medium_constraint_count,
  coalesce(cc.low_constraint_count, 0) as low_constraint_count,
  cc.constraint_summary,
  greatest(coalesce(pc.latest_policy_seen_at, date '1900-01-01'), coalesce(ac.latest_activity_seen_at, date '1900-01-01')) as latest_signal_date
from public.precincts p
left join public.councils c on c.id = p.primary_council_id
left join latest_targets lt on lt.council_id = p.primary_council_id
left join proposal_counts pc on pc.precinct_id = p.id
left join application_counts ac on ac.precinct_id = p.id
left join public.v_precinct_constraint_summary cc on cc.precinct_id = p.id;

create or replace view public.v_precinct_shortlist as
select
  oi.id,
  oi.item_key,
  oi.item_name,
  oi.precinct_id,
  oi.opportunity_rating,
  oi.policy_score,
  oi.capacity_score,
  oi.friction_score,
  oi.timing_score,
  oi.analyst_confidence,
  oi.recommended_action,
  oi.trigger_summary,
  oi.workflow_status,
  oi.last_reviewed_at,
  p.precinct_code,
  p.name as precinct_name,
  p.precinct_type,
  p.policy_theme,
  p.watch_priority,
  c.canonical_name as council_name,
  vpss.active_pipeline_count,
  vpss.made_count,
  vpss.withdrawn_count,
  vpss.recent_application_window_start,
  vpss.recent_application_count,
  vpss.recent_da_count,
  vpss.recent_cdc_count,
  vpss.recent_ssd_count,
  vpss.recent_modification_count,
  vpss.recent_other_count,
  vpss.state_significant_count,
  vpss.constraint_count,
  vpss.high_constraint_count,
  vpss.medium_constraint_count,
  vpss.low_constraint_count,
  vpss.constraint_summary,
  vpss.council_target_value,
  vpss.urban_tree_canopy_pct,
  vpss.high_heat_vulnerability_pct
from public.opportunity_items oi
left join public.precincts p on p.id = oi.precinct_id
left join public.councils c on c.id = oi.council_id
left join public.v_precinct_signal_summary vpss on vpss.precinct_id = oi.precinct_id
where oi.geography_level = 'precinct'
  and oi.workflow_status = 'active'
order by
  case oi.opportunity_rating when 'A' then 1 when 'B' then 2 else 3 end,
  case
    when coalesce(vpss.active_pipeline_count, 0) > 0
      or coalesce(vpss.recent_application_count, 0) > 0
      or coalesce(vpss.state_significant_count, 0) > 0 then 0
    else 1
  end,
  oi.friction_score asc nulls last,
  oi.timing_score desc nulls last,
  oi.policy_score desc nulls last,
  oi.item_name;

create or replace view public.v_precinct_map_points as
with application_centroids as (
  select
    a.precinct_id,
    avg(a.latitude) as centroid_latitude,
    avg(a.longitude) as centroid_longitude,
    count(*) filter (where a.latitude is not null and a.longitude is not null) as point_count
  from public.application_signals a
  where a.precinct_id is not null
    and a.latitude is not null
    and a.longitude is not null
  group by a.precinct_id
)
select
  vps.precinct_name,
  vps.council_name,
  vps.opportunity_rating,
  vps.policy_score,
  vps.friction_score,
  vps.timing_score,
  vps.recent_application_count,
  vps.active_pipeline_count,
  vps.constraint_summary,
  ac.centroid_latitude,
  ac.centroid_longitude,
  ac.point_count
from public.v_precinct_shortlist vps
join application_centroids ac on ac.precinct_id = vps.precinct_id
order by
  case vps.opportunity_rating when 'A' then 1 when 'B' then 2 else 3 end,
  vps.friction_score asc nulls last,
  vps.recent_application_count desc nulls last,
  vps.precinct_name;
