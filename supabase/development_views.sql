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
