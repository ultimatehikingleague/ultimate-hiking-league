-- Follow-up to the deployed Garmin publication and COMMON migrations.
-- The publication function reads the private review table from 20261123.
-- Apply both migrations before enabling the Garmin submission route.
-- PostgreSQL runs same-kind triggers by name. Recalculate speed between
-- trg_calculate_avg_speed (legacy time_hours) and trg_set_record_division.
create function public.calculate_record_speed_from_minutes()
returns trigger language plpgsql set search_path = '' as $$
declare
  time_parts text[];
  elapsed_minutes numeric;
begin
  if new.garmin_verified is distinct from true then return new; end if;

  time_parts := regexp_match(btrim(new.time_text), '^([0-9]+):([0-5][0-9])$');
  if time_parts is null then return new; end if;

  -- Preserve stored speed on metadata updates, including existing Garmin
  -- records whose immutable measurements predate this calculation.
  if tg_op = 'UPDATE' and
    row(new.distance_km, new.time_text) is not distinct from row(old.distance_km, old.time_text)
  then
    new.avg_speed := old.avg_speed;
    return new;
  end if;

  elapsed_minutes := time_parts[1]::numeric * 60 + time_parts[2]::numeric;
  if elapsed_minutes > 0 then
    new.avg_speed := round(new.distance_km * 60 / elapsed_minutes, 2);
  end if;
  return new;
end;
$$;

create trigger trg_calculate_record_speed_from_minutes
before insert or update on public.records
for each row execute function public.calculate_record_speed_from_minutes();

revoke execute on function public.calculate_record_speed_from_minutes()
  from public, anon, authenticated, service_role;

create or replace function public.publish_garmin_activity(
  p_owner uuid, p_hiker_id bigint, p_activity_id text, p_connection_id text,
  p_connected_at timestamptz, p_expected jsonb, p_metadata jsonb
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  activity public.garmin_activities;
  private_review jsonb;
  review_reason text;
  evidence jsonb;
  elapsed jsonb;
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
  stored_speed public.records.avg_speed%type;
begin
  perform 1 from public.garmin_connections
  where user_id = p_owner and garmin_user_id = p_connection_id and connected_at = p_connected_at
    and activity_export_revoked_at is null and deregistered_at is null and disconnect_lease_until is null
  for update;
  if not found then return 'revoked'; end if;

  perform 1 from public.hikers where id = p_hiker_id and claimed_by_user_id = p_owner for update;
  if not found then return 'not-found'; end if;

  select * into activity from public.garmin_activities
    where owner_id = p_owner and activity_id = p_activity_id for share;
  if not found then return 'not-found'; end if;
  -- Inbox delivery also locks the connection. It cannot insert the first
  -- review or change evidence between this snapshot check and publication.
  select jsonb_build_array(r.status, r.evidence, r.conflicting_feeds, r.reason), r.reason into private_review, review_reason
    from public.garmin_private_reviews r where r.owner_id = p_owner and r.activity_id = p_activity_id
    for share;
  if (jsonb_build_array(activity.summary, activity.details, activity.file_metrics) ||
      case when private_review is null then '[]'::jsonb else jsonb_build_array(private_review) end)
    is distinct from p_expected then return 'changed'; end if;

  if private_review is null then return 'ineligible'; end if;
  evidence := private_review->1;
  elapsed := evidence#>'{activityDetails,elapsedSeconds}';
  if (private_review->>0 is distinct from 'consistent' and not coalesce(
      private_review->>0 = 'unresolved' and review_reason in ('samples-incomplete', 'samples-missing'), false))
    or private_review->2 is distinct from '[]'::jsonb
    or evidence#>>'{activityDetails,sampleCheck}' in ('sample-time-inconsistent', 'sample-coordinates-invalid', 'sample-gps-jump')
    or evidence#>'{activityFiles,manual}' is distinct from 'false'::jsonb
    or evidence#>'{activities,type}' is distinct from activity.summary->'type'
    or evidence#>'{activities,device}' is distinct from activity.summary->'device'
    or evidence#>'{activities,startTimeInSeconds}' is distinct from activity.summary->'startTimeInSeconds'
    or evidence#>'{activities,distanceKm}' is distinct from activity.summary->'distanceKm'
    or evidence#>'{activities,ascent}' is distinct from activity.summary->'ascent'
    or jsonb_typeof(elapsed) is distinct from 'number'
  then return 'ineligible'; end if;
  if activity.file_metrics @> '{"fitVerified":true}' then
    if activity.file_metrics->'fitStartTime' is distinct from activity.summary->'startTimeInSeconds'
      or jsonb_typeof(activity.file_metrics->'fitElapsedSeconds') is distinct from 'number'
    then return 'ineligible'; end if;
    if abs((activity.file_metrics->>'fitElapsedSeconds')::numeric - (elapsed#>>'{}')::numeric) > 1
    then return 'ineligible'; end if;
  end if;

  if activity.summary->>'type' is distinct from 'HIKING'
    or nullif(btrim(activity.summary->>'device'), '') is null
    or activity.summary @> '{"manual":true}' or activity.summary @> '{"isWebUpload":true}'
    or (activity.details->>'type' is not null and activity.details->>'type' not in ('HIKING', 'WALKING', 'CASUAL_WALKING', 'SPEED_WALKING'))
    or (activity.file_metrics->>'type' is not null and activity.file_metrics->>'type' not in ('HIKING', 'WALKING', 'CASUAL_WALKING', 'SPEED_WALKING'))
    or activity.details @> '{"manual":true}' or activity.details @> '{"isWebUpload":true}'
    or activity.file_metrics @> '{"manual":true}' or activity.file_metrics @> '{"isWebUpload":true}'
    or coalesce(activity.file_metrics->'warnings', '[]'::jsonb) <> '[]'::jsonb
    or pg_catalog.jsonb_typeof(activity.summary->'startTimeInSeconds') is distinct from 'number'
    or pg_catalog.jsonb_typeof(activity.summary->'distanceKm') is distinct from 'number'
    or pg_catalog.jsonb_typeof(activity.summary->'ascent') is distinct from 'number'
    or pg_catalog.jsonb_typeof(elapsed) is distinct from 'number'
  then return 'ineligible'; end if;

  distance := (activity.summary->>'distanceKm')::numeric;
  ascent := (activity.summary->>'ascent')::numeric;
  seconds := (elapsed#>>'{}')::numeric;
  if distance <= 0 or ascent < 0
    or seconds < 60 or seconds / 60 > 2147483647
    or distance * 3600 > 15 * seconds or ascent * 3600 > 2000 * seconds
    or trunc((activity.summary->>'startTimeInSeconds')::numeric) <> (activity.summary->>'startTimeInSeconds')::numeric
    or (activity.summary->>'startTimeInSeconds')::numeric < 1
    or (activity.summary->>'startTimeInSeconds')::numeric + seconds > extract(epoch from now()) + 1
  then return 'ineligible'; end if;

  distance := round(distance, 2);
  ascent := round(ascent);
  if distance < 10 and ascent < 600 then return 'ineligible'; end if;

  entered_date := (p_metadata->>'activity_date')::date;
  if entered_date is null or entered_date > (now() at time zone 'Europe/Berlin')::date
    or length(coalesce(p_metadata->>'activity_name', '')) > 240
    or length(coalesce(p_metadata->>'description', '')) > 240
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
    custom_title, custom_location, custom_country, custom_description
  ) values (
    p_hiker_id, true, distance, ascent, display_time, minutes / 60.0, round(distance * 60 / minutes, 2),
    entered_date, true, 'verified_admin_submission', 'Garmin', false, true,
    coalesce(nullif(btrim(p_metadata->>'activity_name'), ''), 'Garmin-Wanderung'),
    nullif(btrim(p_metadata->>'location'), ''),
    nullif(btrim(p_metadata->>'country'), ''),
    nullif(btrim(p_metadata->>'description'), '')
  ) returning distance_km, elevation_gain, time_text, time_hours, avg_speed
    into stored_distance, stored_ascent, stored_time, stored_hours, stored_speed;

  if stored_distance is distinct from distance or stored_ascent is distinct from ascent
    or stored_time is distinct from display_time
    or stored_hours is null or abs(stored_hours::numeric * 60 - minutes) >= 0.5
    or stored_speed is distinct from round(distance * 60 / minutes, 2) then
    raise exception 'Record storage changed Garmin measurements';
  end if;
  return 'published';
end;
$$;

create or replace function public.check_garmin_record_correction()
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
