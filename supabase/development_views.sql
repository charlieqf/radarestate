drop view if exists public.v_site_screening_latest;
drop view if exists public.v_site_constraints_latest;
drop view if exists public.v_site_controls_latest;
drop view if exists public.v_site_candidates_latest;
drop view if exists public.v_precinct_property_contexts;
drop view if exists public.v_precinct_parcel_metrics;
drop view if exists public.v_precinct_planning_controls;

create or replace view public.v_precinct_planning_controls as
select
  pc.id,
  p.id as precinct_id,
  p.precinct_code,
  p.name as precinct_name,
  c.canonical_name as council_name,
  pc.observed_at,
  pc.sample_point_count,
  pc.matched_point_count,
  pc.sample_location_example,
  pc.dominant_zoning_code,
  pc.dominant_zoning_label,
  pc.zoning_layer_name,
  pc.zoning_epi_name,
  pc.fsr_min,
  pc.fsr_max,
  pc.fsr_clause,
  pc.fsr_epi_name,
  pc.height_min_m,
  pc.height_max_m,
  pc.height_clause,
  pc.height_epi_name,
  pc.zoning_source_url,
  pc.fsr_source_url,
  pc.height_source_url,
  pc.notes
from public.planning_controls pc
join public.precincts p on p.id = pc.precinct_id
left join public.councils c on c.id = pc.council_id;

create or replace view public.v_precinct_parcel_metrics as
select
  pm.id,
  p.id as precinct_id,
  p.precinct_code,
  p.name as precinct_name,
  c.canonical_name as council_name,
  pm.observed_at,
  pm.sample_point_count,
  pm.matched_parcel_count,
  pm.sample_location_example,
  pm.lot_count,
  pm.example_lot_id,
  pm.example_plan_label,
  pm.plan_area_min_sqm,
  pm.plan_area_max_sqm,
  pm.geometry_area_min_sqm,
  pm.geometry_area_max_sqm,
  pm.perimeter_min_m,
  pm.perimeter_max_m,
  pm.bbox_width_min_m,
  pm.bbox_width_max_m,
  pm.bbox_height_min_m,
  pm.bbox_height_max_m,
  pm.frontage_candidate_min_m,
  pm.frontage_candidate_max_m,
  pm.frontage_method,
  pm.source_url,
  pm.notes
from public.parcel_metrics pm
join public.precincts p on p.id = pm.precinct_id
left join public.councils c on c.id = pm.council_id;

create or replace view public.v_precinct_property_contexts as
select
  pc.id,
  p.id as precinct_id,
  p.precinct_code,
  p.name as precinct_name,
  c.canonical_name as council_name,
  pc.observed_at,
  pc.sample_point_count,
  pc.matched_property_count,
  pc.sample_location_example,
  pc.example_propid,
  pc.example_address,
  pc.dominant_property_type,
  pc.dominant_valnet_status,
  pc.dominant_valnet_type,
  pc.dissolve_parcel_count_min,
  pc.dissolve_parcel_count_max,
  pc.valnet_lot_count_min,
  pc.valnet_lot_count_max,
  pc.source_url,
  pc.notes
from public.property_contexts pc
join public.precincts p on p.id = pc.precinct_id
left join public.councils c on c.id = pc.council_id;

create or replace view public.v_site_candidates_latest as
select
  sc.id as site_candidate_id,
  sc.site_key,
  p.id as precinct_id,
  p.precinct_code,
  p.name as precinct_name,
  c.canonical_name as council_name,
  c.region_group,
  sc.observed_at,
  sc.matched_signal_count,
  sc.latest_lodgement_date,
  sc.sample_location_example,
  sc.latitude,
  sc.longitude,
  sc.lot_id,
  sc.lot_number,
  sc.plan_number,
  sc.plan_label,
  sc.propid,
  sc.address,
  sc.plan_area_sqm,
  sc.geometry_area_sqm,
  sc.perimeter_m,
  sc.bbox_width_m,
  sc.bbox_height_m,
  sc.frontage_candidate_m,
  sc.property_type,
  sc.valnet_status,
  sc.valnet_type,
  sc.dissolve_parcel_count,
  sc.valnet_lot_count,
  sc.source_url,
  sc.notes
from public.site_candidates sc
join public.precincts p on p.id = sc.precinct_id
left join public.councils c on c.id = sc.council_id;

create or replace view public.v_site_controls_latest as
select
  ctl.id,
  ctl.site_candidate_id,
  cand.site_key,
  cand.precinct_id,
  cand.precinct_code,
  cand.precinct_name,
  cand.council_name,
  cand.region_group,
  ctl.observed_at,
  ctl.zoning_code,
  ctl.zoning_label,
  ctl.zoning_epi_name,
  ctl.fsr,
  ctl.fsr_clause,
  ctl.fsr_epi_name,
  ctl.height_m,
  ctl.height_clause,
  ctl.height_epi_name,
  ctl.minimum_lot_size_sqm,
  ctl.minimum_lot_size_units,
  ctl.minimum_lot_size_clause,
  ctl.minimum_lot_size_epi_name,
  ctl.zoning_source_url,
  ctl.fsr_source_url,
  ctl.height_source_url,
  ctl.minimum_lot_size_source_url,
  ctl.notes
from public.site_controls ctl
join public.v_site_candidates_latest cand on cand.site_candidate_id = ctl.site_candidate_id;

create or replace view public.v_site_constraints_latest as
select
  sc.id,
  sc.site_candidate_id,
  cand.site_key,
  cand.precinct_id,
  cand.precinct_code,
  cand.precinct_name,
  cand.council_name,
  cand.region_group,
  sc.observed_at,
  sc.constraint_type,
  sc.severity,
  sc.source_name,
  sc.source_url,
  sc.notes
from public.site_constraints sc
join public.v_site_candidates_latest cand on cand.site_candidate_id = sc.site_candidate_id;

create or replace view public.v_site_screening_latest as
with constraint_agg as (
  select
    sc.site_candidate_id,
    count(*)::int as constraint_count,
    count(*) filter (where sc.severity = 'high')::int as high_constraint_count,
    count(*) filter (where sc.severity = 'medium')::int as medium_constraint_count,
    count(*) filter (where sc.severity = 'low')::int as low_constraint_count,
    string_agg(
      initcap(replace(sc.constraint_type, '_', ' ')) || ' [' || sc.severity || ']',
      '; '
      order by case sc.severity when 'high' then 1 when 'medium' then 2 else 3 end, sc.constraint_type
    ) as constraint_summary
  from public.site_constraints sc
  group by sc.site_candidate_id
), base as (
  select
    cand.site_candidate_id,
    cand.site_key,
    cand.precinct_id,
    cand.precinct_code,
    cand.precinct_name,
    cand.council_name,
    cand.region_group,
    cand.observed_at,
    coalesce(nullif(cand.address, ''), cand.sample_location_example, cand.lot_id, cand.site_key) as site_label,
    cand.address,
    cand.sample_location_example,
    cand.latitude,
    cand.longitude,
    cand.lot_id,
    cand.lot_number,
    cand.plan_number,
    cand.plan_label,
    cand.propid,
    cand.matched_signal_count,
    cand.latest_lodgement_date,
    cand.plan_area_sqm,
    cand.geometry_area_sqm,
    cand.perimeter_m,
    cand.bbox_width_m,
    cand.bbox_height_m,
    cand.frontage_candidate_m,
    cand.property_type,
    cand.valnet_status,
    cand.valnet_type,
    cand.dissolve_parcel_count,
    cand.valnet_lot_count,
    ctl.zoning_code,
    ctl.zoning_label,
    ctl.zoning_epi_name,
    ctl.fsr,
    ctl.fsr_clause,
    ctl.fsr_epi_name,
    ctl.height_m,
    ctl.height_clause,
    ctl.height_epi_name,
    ctl.minimum_lot_size_sqm,
    ctl.minimum_lot_size_units,
    ctl.minimum_lot_size_clause,
    ctl.minimum_lot_size_epi_name,
    coalesce(
      nullif(regexp_replace(coalesce(ctl.zoning_epi_name, ctl.fsr_epi_name, ctl.height_epi_name, ctl.minimum_lot_size_epi_name, ''), '\s+(Local|Regional)\s+Environmental\s+Plan.*$', '', 'i'), ''),
      cand.council_name,
      cand.precinct_name
    ) as apparent_site_jurisdiction,
    coalesce(ca.constraint_count, 0) as constraint_count,
    coalesce(ca.high_constraint_count, 0) as high_constraint_count,
    coalesce(ca.medium_constraint_count, 0) as medium_constraint_count,
    coalesce(ca.low_constraint_count, 0) as low_constraint_count,
    coalesce(ca.constraint_summary, 'No current site-level derived constraint hit') as constraint_summary,
    ps.opportunity_rating as precinct_opportunity_rating,
    ps.policy_score as precinct_policy_score,
    ps.timing_score as precinct_timing_score,
    ps.friction_score as precinct_friction_score,
    case ps.opportunity_rating when 'A' then 18 when 'B' then 12 when 'C' then 6 else 2 end as precinct_score,
    case
      when coalesce(cand.geometry_area_sqm, cand.plan_area_sqm, 0) between 450 and 1200 then 12
      when coalesce(cand.geometry_area_sqm, cand.plan_area_sqm, 0) > 1200 and coalesce(cand.geometry_area_sqm, cand.plan_area_sqm, 0) <= 2500 then 10
      when coalesce(cand.geometry_area_sqm, cand.plan_area_sqm, 0) between 250 and 449.999 then 8
      when coalesce(cand.geometry_area_sqm, cand.plan_area_sqm, 0) > 2500 and coalesce(cand.geometry_area_sqm, cand.plan_area_sqm, 0) <= 4000 then 7
      when coalesce(cand.geometry_area_sqm, cand.plan_area_sqm, 0) > 4000 and coalesce(cand.geometry_area_sqm, cand.plan_area_sqm, 0) <= 7000 then 4
      when coalesce(cand.geometry_area_sqm, cand.plan_area_sqm, 0) > 7000 then 1
      else 0
    end as area_score,
    case
      when coalesce(cand.frontage_candidate_m, 0) between 16 and 32 then 8
      when coalesce(cand.frontage_candidate_m, 0) >= 12 and coalesce(cand.frontage_candidate_m, 0) < 16 then 6
      when coalesce(cand.frontage_candidate_m, 0) > 32 and coalesce(cand.frontage_candidate_m, 0) <= 50 then 4
      when coalesce(cand.frontage_candidate_m, 0) >= 8 and coalesce(cand.frontage_candidate_m, 0) < 12 then 2
      when coalesce(cand.frontage_candidate_m, 0) > 50 then 1
      else 0
    end as frontage_score,
    case
      when coalesce(ctl.fsr, 0) between 0.75 and 1.5 then 8
      when coalesce(ctl.fsr, 0) > 1.5 and coalesce(ctl.fsr, 0) < 2.5 then 6
      when coalesce(ctl.fsr, 0) >= 2.5 and coalesce(ctl.fsr, 0) < 4 then 4
      when coalesce(ctl.fsr, 0) >= 4 then 2
      when coalesce(ctl.fsr, 0) >= 0.5 then 3
      else 0
    end as fsr_score,
    case
      when coalesce(ctl.height_m, 0) between 9 and 15 then 8
      when coalesce(ctl.height_m, 0) > 15 and coalesce(ctl.height_m, 0) <= 24 then 6
      when coalesce(ctl.height_m, 0) > 24 and coalesce(ctl.height_m, 0) <= 35 then 4
      when coalesce(ctl.height_m, 0) > 35 then 2
      when coalesce(ctl.height_m, 0) >= 6 then 3
      else 0
    end as height_score,
    least(coalesce(cand.matched_signal_count, 0), 5) * 2 as signal_score,
    case
      when coalesce(cand.geometry_area_sqm, cand.plan_area_sqm, 0) >= 15000 then 10
      when coalesce(cand.geometry_area_sqm, cand.plan_area_sqm, 0) >= 8000 then 7
      when coalesce(cand.geometry_area_sqm, cand.plan_area_sqm, 0) >= 5000 then 4
      else 0
    end as oversize_penalty,
    case
      when coalesce(ctl.fsr, 0) >= 8 or coalesce(ctl.height_m, 0) >= 80 then 4
      when coalesce(ctl.fsr, 0) >= 5 or coalesce(ctl.height_m, 0) >= 45 then 2
      else 0
    end as large_format_penalty,
    (coalesce(ca.high_constraint_count, 0) * 10) + (coalesce(ca.medium_constraint_count, 0) * 5) as constraint_penalty,
    least(
      case
        when coalesce(cand.valnet_type, '') = 'UNDERSP' or coalesce(cand.lot_id, '') like '%SP%' then 16
        when coalesce(cand.valnet_type, '') = 'STRATA' then 12
        else 0
      end
      + case
          when coalesce(cand.valnet_lot_count, 0) >= 50 then 8
          when coalesce(cand.valnet_lot_count, 0) >= 20 then 5
          when coalesce(cand.valnet_lot_count, 0) >= 5 then 2
          else 0
        end
      + case
          when coalesce(cand.dissolve_parcel_count, 0) >= 3 then 4
          when coalesce(cand.dissolve_parcel_count, 0) = 2 then 2
          else 0
        end,
      24
    ) as title_complexity_penalty
  from public.v_site_candidates_latest cand
  left join public.v_site_controls_latest ctl on ctl.site_candidate_id = cand.site_candidate_id
  left join constraint_agg ca on ca.site_candidate_id = cand.site_candidate_id
  left join public.v_precinct_shortlist ps on ps.precinct_id = cand.precinct_id
), scored as (
  select
    base.*,
    case
      when coalesce(base.apparent_site_jurisdiction, '') <> ''
        and coalesce(base.council_name, '') <> ''
        and base.apparent_site_jurisdiction <> base.council_name
        then base.precinct_name || ' - ' || base.apparent_site_jurisdiction
      else base.precinct_name
    end as watchlist_bucket_name,
    (
      base.precinct_score
      + base.area_score
      + base.frontage_score
      + base.fsr_score
      + base.height_score
      + base.signal_score
      - base.oversize_penalty
      - base.large_format_penalty
      - base.constraint_penalty
      - base.title_complexity_penalty
    ) as screening_score
  from base
)
select
  scored.*,
  case
    when scored.screening_score >= 42 and scored.high_constraint_count = 0 and scored.title_complexity_penalty = 0 then 'Advance'
    when scored.screening_score >= 24 then 'Review'
    else 'Caution'
  end as screening_band,
  case
    when scored.screening_score >= 42 and scored.high_constraint_count = 0 and scored.title_complexity_penalty = 0 then 'Advance to site review'
    when scored.title_complexity_penalty > 0 then 'Review title / strata complexity before promotion'
    when scored.oversize_penalty > 0 or scored.large_format_penalty > 0 then 'Validate under strategic larger-format lens before promotion'
    when scored.screening_score >= 24 then 'Validate controls and constraints'
    else 'Keep on caution list'
  end as recommended_site_action
from scored;
