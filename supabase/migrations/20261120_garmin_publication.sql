-- Preserve the provider identity across disconnects and record deletion without exposing IDs.
create table public.garmin_publications (
  source_key bytea primary key
);
alter table public.garmin_publications enable row level security;
revoke all on public.garmin_publications from public, anon, authenticated, service_role;

alter table public.records
  add column garmin_verified boolean not null default false;

create function public.protect_garmin_record()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.garmin_verified and current_user in ('anon', 'authenticated') then
      raise exception 'Garmin provenance is server-managed' using errcode = '42501';
    end if;
  elsif new.garmin_verified is distinct from old.garmin_verified
    or (old.garmin_verified and (
      row(new.distance_km, new.elevation_gain, new.time_text, new.time_hours,
        new.avg_speed, new.division, new.verified, new.record_status, new.record_source, new.event_master_id, new.event_distance_id, new.event_id)
      is distinct from
      row(old.distance_km, old.elevation_gain, old.time_text, old.time_hours,
        old.avg_speed, old.division, old.verified, old.record_status, old.record_source, old.event_master_id, old.event_distance_id, old.event_id)
      or (current_user in ('anon', 'authenticated') and
        row(new.custom_title, new.activity_date, new.custom_location, new.custom_country)
        is distinct from
        row(old.custom_title, old.activity_date, old.custom_location, old.custom_country))
    )) then
    raise exception 'Garmin provenance and measurements are immutable' using errcode = '42501';
  end if;
  return null;
end;
$$;

-- Inspect the values after existing BEFORE triggers have calculated time and speed.
create trigger protect_garmin_record
after insert or update on public.records for each row execute function public.protect_garmin_record();

create function public.publish_garmin_activity(
  p_owner uuid, p_hiker_id bigint, p_activity_id text, p_connection_id text,
  p_connected_at timestamptz, p_expected jsonb, p_metadata jsonb
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  activity public.garmin_activities;
  source_key bytea;
  distance numeric;
  ascent numeric;
  seconds numeric;
  minutes integer;
  display_time text;
  entered_date date;
  stored_distance public.records.distance_km%type;
  stored_ascent public.records.elevation_gain%type;
  stored_time public.records.time_text%type;
  stored_hours public.records.time_hours%type;
begin
  perform 1 from public.garmin_connections
  where user_id = p_owner and garmin_user_id = p_connection_id and connected_at = p_connected_at
    and activity_export_revoked_at is null and disconnect_lease_until is null
  for share;
  if not found then return 'revoked'; end if;

  perform 1 from public.hikers where id = p_hiker_id and claimed_by_user_id = p_owner for update;
  if not found then return 'not-found'; end if;

  select * into activity from public.garmin_activities
    where owner_id = p_owner and activity_id = p_activity_id for share;
  if not found then return 'not-found'; end if;
  if pg_catalog.jsonb_build_array(activity.summary, activity.details, activity.file_metrics)
    is distinct from p_expected then return 'changed'; end if;

  if activity.summary->>'type' is null or activity.summary->>'type' not in ('HIKING', 'WALKING', 'CASUAL_WALKING', 'SPEED_WALKING')
    or nullif(btrim(activity.summary->>'device'), '') is null
    or activity.summary->'manual' is distinct from 'false'::jsonb
    or activity.summary->'isWebUpload' is distinct from 'false'::jsonb
    or (activity.details->>'type' is not null and activity.details->>'type' not in ('HIKING', 'WALKING', 'CASUAL_WALKING', 'SPEED_WALKING'))
    or (activity.file_metrics->>'type' is not null and activity.file_metrics->>'type' not in ('HIKING', 'WALKING', 'CASUAL_WALKING', 'SPEED_WALKING'))
    or activity.details @> '{"manual":true}' or activity.details @> '{"isWebUpload":true}'
    or activity.file_metrics @> '{"manual":true}' or activity.file_metrics @> '{"isWebUpload":true}'
    or coalesce(activity.file_metrics->'warnings', '[]'::jsonb) <> '[]'::jsonb
    or activity.summary->'startTimeInSeconds' is distinct from activity.file_metrics->'fitStartTime'
    or pg_catalog.jsonb_typeof(activity.summary->'startTimeInSeconds') is distinct from 'number'
    or pg_catalog.jsonb_typeof(activity.summary->'distanceKm') is distinct from 'number'
    or pg_catalog.jsonb_typeof(activity.summary->'ascent') is distinct from 'number'
    or activity.file_metrics->'fitVerified' is distinct from 'true'::jsonb
    or pg_catalog.jsonb_typeof(activity.file_metrics->'fitElapsedSeconds') is distinct from 'number'
  then return 'ineligible'; end if;

  distance := (activity.summary->>'distanceKm')::numeric;
  ascent := (activity.summary->>'ascent')::numeric;
  seconds := (activity.file_metrics->>'fitElapsedSeconds')::numeric;
  if distance <= 0 or ascent < 0
    or seconds < 60 or seconds / 60 > 2147483647
    or distance * 3600 > 15 * seconds or ascent * 3600 > 2000 * seconds
    or trunc((activity.summary->>'startTimeInSeconds')::numeric) <> (activity.summary->>'startTimeInSeconds')::numeric
    or (activity.summary->>'startTimeInSeconds')::numeric not between 1 and extract(epoch from now())
  then return 'ineligible'; end if;

  distance := round(distance, 2);
  ascent := round(ascent);
  if distance < 10 and ascent < 600 then return 'ineligible'; end if;

  entered_date := (p_metadata->>'activity_date')::date;
  if entered_date is null or entered_date > (now() at time zone 'Europe/Berlin')::date
    or length(coalesce(p_metadata->>'activity_name', '')) > 240
    or length(coalesce(p_metadata->>'location', '')) > 240
    or length(coalesce(p_metadata->>'country', '')) > 100
  then return 'ineligible'; end if;

  source_key := pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.jsonb_build_array(p_connection_id, p_activity_id)::text, 'UTF8'));
  insert into public.garmin_publications values (source_key) on conflict do nothing;
  if not found then return 'already-published'; end if;

  minutes := floor(seconds / 60);
  display_time := case when minutes < 600 then '0' else '' end
    || (minutes / 60)::text || ':' || lpad((minutes % 60)::text, 2, '0');

  -- Catch existing records filed through a different intake path. The hiker
  -- lock serializes Garmin submissions, and a raised error rolls back the source claim.
  if exists (
    select 1 from public.records r
    where r.hiker_id = p_hiker_id and r.activity_date = entered_date
      and round(r.distance_km::numeric, 2) = distance
      and (r.time_text = display_time or abs(r.time_hours::numeric * 60 - minutes) < 0.5)
  ) then
    raise exception 'Matching record already exists' using errcode = '23505';
  end if;

  insert into public.records (
    hiker_id, is_public, distance_km, elevation_gain, time_text, time_hours, avg_speed,
    activity_date, verified, record_status, record_source, is_corrected, garmin_verified,
    custom_title, custom_location, custom_country
  ) values (
    p_hiker_id, true, distance, ascent, display_time, minutes / 60.0, round(distance * 60 / minutes, 2),
    entered_date, true, 'verified_admin_submission', 'Garmin', false, true,
    coalesce(nullif(btrim(p_metadata->>'activity_name'), ''), 'Garmin-Wanderung'),
    nullif(btrim(p_metadata->>'location'), ''),
    nullif(btrim(p_metadata->>'country'), '')
  ) returning distance_km, elevation_gain, time_text, time_hours
    into stored_distance, stored_ascent, stored_time, stored_hours;

  if stored_distance is distinct from distance or stored_ascent is distinct from ascent
    or stored_time is distinct from display_time
    or stored_hours is null or abs(stored_hours::numeric * 60 - minutes) >= 0.5 then
    raise exception 'Record storage changed Garmin measurements';
  end if;
  return 'published';
end;
$$;

revoke all on function public.publish_garmin_activity(uuid, bigint, text, text, timestamptz, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.publish_garmin_activity(uuid, bigint, text, text, timestamptz, jsonb, jsonb)
  to service_role;
revoke execute on function public.submit_garmin_activity(uuid, bigint, text, text, timestamptz, jsonb)
  from service_role;

create function public.check_garmin_record_correction()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  target public.records;
begin
  select * into target from public.records where id = new.record_id and garmin_verified;
  if tg_op = 'UPDATE' then
    if (target.id is not null or exists (select 1 from public.records where id = old.record_id and garmin_verified))
      and row(new.record_id, new.hiker_id, new.user_id) is distinct from row(old.record_id, old.hiker_id, old.user_id)
    then raise exception 'Garmin correction identity is immutable' using errcode = '42501'; end if;
    if target.id is null then return new; end if;
    if old.status is distinct from 'pending' or (new.status is null or new.status not in ('approved', 'rejected'))
      or not exists (select 1 from public.admin_users where user_id = auth.uid())
    then raise exception 'Garmin correction requires a pending request and an admin decision' using errcode = '42501'; end if;
  elsif target.id is null then return new;
  elsif new.status is distinct from 'pending' or new.user_id is distinct from auth.uid()
    or not exists (select 1 from public.hikers
      where id = target.hiker_id and id = new.hiker_id and claimed_by_user_id = auth.uid()) then
    raise exception 'Garmin correction requires the record owner' using errcode = '42501';
  end if;

  if new.official_distance_km is not null or new.actual_distance_km is not null
    or new.elevation_gain is not null or new.proposed_time_text is not null or new.record_source is not null then
    raise exception 'Garmin measurements cannot be proposed for correction' using errcode = '42501';
  end if;
  if new.activity_date > (now() at time zone 'Europe/Berlin')::date
    or length(coalesce(new.activity_name, '')) > 240
    or length(coalesce(new.location, '')) > 240 or length(coalesce(new.country, '')) > 100 then
    raise exception 'Invalid Garmin correction metadata' using errcode = '22023';
  end if;
  -- The existing Admin status update applies the correction in the same transaction.
  if tg_op = 'UPDATE' and new.status = 'approved' then
    update public.records set
      custom_title = coalesce(nullif(btrim(new.activity_name), ''), custom_title),
      custom_location = nullif(btrim(new.location), ''),
      custom_country = nullif(btrim(new.country), ''),
      activity_date = coalesce(new.activity_date, activity_date),
      is_corrected = true
    where id = target.id and hiker_id = new.hiker_id and garmin_verified;
    if not found then raise exception 'Garmin record is unavailable'; end if;
  end if;
  return new;
end;
$$;

create trigger check_garmin_record_correction before insert or update on public.record_corrections
for each row execute function public.check_garmin_record_correction();

revoke execute on function public.protect_garmin_record(), public.check_garmin_record_correction()
  from public, anon, authenticated, service_role;
