-- Read-only fingerprint of the fields reviewed in the 2027 calendar.
select md5(coalesce(jsonb_agg(jsonb_build_array(
  e.id, e.slug, e.title, e.city, e.country, e.country_code, e.event_date,
  e.brand, e.official_url, e.status,
  (select coalesce(jsonb_agg(trim_scale(d.distance_km) order by d.distance_km), '[]'::jsonb)
   from public.event_distances d where d.event_id = e.id)
) order by e.id)::text, '[]')) as fingerprint, count(*) as event_count
from public.events_master e
where e.event_date >= date '2027-01-01' and e.event_date < date '2028-01-01';
