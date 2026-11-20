begin;

create table public.garmin_record_attributions (
  record_id bigint primary key references public.records(id) on delete cascade,
  device_model text not null check (char_length(btrim(device_model)) between 1 and 160)
);
alter table public.garmin_record_attributions enable row level security;
revoke all on public.garmin_record_attributions from public, anon, authenticated, service_role;
grant select on public.garmin_record_attributions to anon, authenticated, service_role;
create policy read_visible_garmin_attribution on public.garmin_record_attributions
for select to anon, authenticated using (exists (
  select 1 from public.records r join public.hikers h on h.id = r.hiker_id
  where r.id = record_id and r.garmin_verified and (
    h.claimed_by_user_id = (select auth.uid())
    or (r.is_public is not false and (r.event_master_id is not null or h.hide_private_records is not true))
  )
));

-- Keep the event snapshot private until the approved record exists.
alter table public.garmin_publications add column device_model text;

-- Patch only attribution writes in the deployed routines, retaining 20261126's
-- search path and every existing check, lock, return value and privilege.
do $migration$
declare
  definition text;
  updated text;
  old_part text;
begin
  definition := pg_get_functiondef('public.publish_garmin_activity(uuid,bigint,text,text,timestamptz,jsonb,jsonb)'::regprocedure);
  old_part := $old$insert into public.garmin_publications (source_key, submission_type, connection_key)
    values (activity_key, kind, case when kind = 'official_event'
      then pg_catalog.sha256(pg_catalog.convert_to(p_connection_id, 'UTF8')) end)$old$;
  updated := replace(definition, old_part, $new$insert into public.garmin_publications (source_key, submission_type, connection_key, device_model)
    values (activity_key, kind, case when kind = 'official_event'
      then pg_catalog.sha256(pg_catalog.convert_to(p_connection_id, 'UTF8')) end,
      case when kind = 'official_event' then nullif(btrim(activity.summary->>'device'), '') end)$new$);
  if updated = definition then raise exception 'Unexpected Garmin publication claim statement'; end if;
  definition := replace(updated, $old$  stored_speed public.records.avg_speed%type;$old$,
    $new$  stored_speed public.records.avg_speed%type;
  stored_id public.records.id%type;$new$);
  if definition = updated then raise exception 'Unexpected Garmin publication declarations'; end if;
  updated := replace(definition, $old$returning distance_km, elevation_gain, time_text, time_hours, avg_speed
    into stored_distance, stored_ascent, stored_time, stored_hours, stored_speed;$old$,
    $new$returning id, distance_km, elevation_gain, time_text, time_hours, avg_speed
    into stored_id, stored_distance, stored_ascent, stored_time, stored_hours, stored_speed;$new$);
  if updated = definition then raise exception 'Unexpected Garmin publication result'; end if;
  definition := replace(updated, $old$  return 'published';$old$, $new$  insert into public.garmin_record_attributions (record_id, device_model)
    select stored_id, btrim(activity.summary->>'device')
    where char_length(btrim(activity.summary->>'device')) between 1 and 160;
  return 'published';$new$);
  if definition = updated then raise exception 'Unexpected Garmin publication exit'; end if;
  execute definition;

  definition := pg_get_functiondef('public.approve_garmin_event_submission(bigint,bigint,bigint,numeric,text)'::regprocedure);
  updated := replace(definition, $old$  update public.record_submissions set
    event_master_id$old$, $new$  insert into public.garmin_record_attributions (record_id, device_model)
    select stored.id, p.device_model from public.garmin_publications p
    where p.source_key = decode(submission.garmin_source_key, 'hex')
      and char_length(p.device_model) between 1 and 160;

  update public.record_submissions set
    event_master_id$new$);
  if updated = definition then raise exception 'Unexpected Garmin event approval statement'; end if;
  execute updated;
end
$migration$;

-- Attribute the existing Wilhermsdorf record only when the stored import and
-- private publication claim agree. Insert metadata without updating the record.
with matches as (
  select r.id, btrim(a.summary->>'device') as model
  from public.records r
  join public.hikers h on h.id = r.hiker_id
  join public.garmin_activities a on a.owner_id = h.claimed_by_user_id
  join public.garmin_connections c on c.user_id = a.owner_id
  join public.garmin_publications p on p.source_key = sha256(
    convert_to(jsonb_build_array(c.garmin_user_id, a.activity_id)::text, 'UTF8'))
  where r.id = 4228 and r.garmin_verified and r.verified and r.event_master_id is null
    and r.activity_date = date '2026-11-15' and r.custom_title = 'Wilhermsdorf Wandern'
    and r.distance_km = 10 and r.elevation_gain = 38 and r.time_text = '02:02'
    and p.submission_type = 'private' and a.summary->>'name' = r.custom_title
    and a.summary @> '{"distanceKm": 10.00084, "ascent": 37.71}'::jsonb
)
insert into public.garmin_record_attributions (record_id, device_model)
select id, model from matches
where (select count(*) from matches) = 1 and char_length(model) between 1 and 160;

notify pgrst, 'reload schema';
commit;
