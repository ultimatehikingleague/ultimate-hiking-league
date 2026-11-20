alter table public.garmin_publications
  add column connection_key bytea,
  add column submission_type text not null default 'private'
    check (submission_type in ('private', 'official_event'));

create or replace function public.publish_garmin_activity(
  p_owner uuid, p_hiker_id bigint, p_activity_id text, p_connection_id text,
  p_connected_at timestamptz, p_expected jsonb, p_metadata jsonb
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  activity public.garmin_activities;
  kind text := coalesce(p_metadata->>'submission_type', 'private');
  event_master public.events_master;
  event_master_id bigint;
  official_distance numeric;
  private_review jsonb;
  review_reason text;
  evidence jsonb;
  elapsed jsonb;
  activity_key bytea;
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
  if kind not in ('private', 'official_event') then return 'ineligible'; end if;

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

  if kind = 'official_event' then
    if jsonb_typeof(p_metadata->'official_distance_km') is distinct from 'number'
      or nullif(btrim(p_metadata->>'activity_name'), '') is null
      or length(coalesce(p_metadata->>'organizer', '')) > 240
    then return 'ineligible'; end if;
    official_distance := (p_metadata->>'official_distance_km')::numeric;
    if round(official_distance, 2) not between 0.01 and 9999.99 or distance not between 0.01 and 9999.99
      or distance < official_distance * 0.97 then return 'ineligible'; end if;
    event_master_id := (p_metadata->>'event_master_id')::bigint;
    if event_master_id is not null then
      select * into event_master from public.events_master e
      where e.id = event_master_id and e.event_date = entered_date for share;
      if not found then return 'ineligible'; end if;
    end if;
  end if;

  activity_key := pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.jsonb_build_array(p_connection_id, p_activity_id)::text, 'UTF8'));
  insert into public.garmin_publications (source_key, submission_type, connection_key)
    values (activity_key, kind, case when kind = 'official_event'
      then pg_catalog.sha256(pg_catalog.convert_to(p_connection_id, 'UTF8')) end)
    on conflict on constraint garmin_publications_pkey do nothing;
  if not found then
    if kind = 'private' and exists (
      select 1 from public.garmin_publications p
      where p.source_key = activity_key and p.submission_type = 'private'
    ) then return 'already-published'; end if;
    return 'duplicate-kind';
  end if;

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

  if kind = 'official_event' then
    insert into public.record_submissions (
      user_id, hiker_id, garmin_source_key, proof_image_url, submission_type, is_public,
      event_master_id, activity_name, activity_date, official_distance_km, actual_distance_km, distance_km,
      elapsed_time_text, elevation_gain, country, location, record_source, status
    ) values (
      p_owner, p_hiker_id, encode(activity_key, 'hex'), 'garmin-activity:' || encode(activity_key, 'hex'),
      'official_event', true, event_master_id,
      case when event_master_id is null then btrim(p_metadata->>'activity_name') else event_master.title end,
      entered_date, official_distance, distance, distance, display_time, ascent,
      case when event_master_id is null then nullif(btrim(p_metadata->>'country'), '') else event_master.country end,
      case when event_master_id is null then nullif(btrim(p_metadata->>'location'), '') else event_master.city end,
      case when event_master_id is null then nullif(btrim(p_metadata->>'organizer'), '') else event_master.brand end,
      'pending'
    );
    return 'submitted';
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

revoke all on function public.publish_garmin_activity(uuid, bigint, text, text, timestamptz, jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.publish_garmin_activity(uuid, bigint, text, text, timestamptz, jsonb, jsonb)
  to service_role;

create or replace function public.protect_garmin_submission()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.garmin_source_key is distinct from old.garmin_source_key
    or (new.garmin_source_key is null and new.proof_image_url like 'garmin-activity:%')
    or (old.garmin_source_key is not null and (
      row(new.is_public, new.submission_type, new.proof_image_url, new.user_id, new.hiker_id,
        new.activity_date, new.distance_km, new.actual_distance_km, new.elevation_gain, new.elapsed_time_text)
      is distinct from
      row(old.is_public, old.submission_type, old.proof_image_url, old.user_id, old.hiker_id,
        old.activity_date, old.distance_km, old.actual_distance_km, old.elevation_gain, old.elapsed_time_text)
    ))
    or (old.garmin_source_key is not null and old.submission_type = 'official_event'
      and current_user in ('anon', 'authenticated')
      and (row(new.event_master_id, new.event_distance_id, new.official_distance_km, new.activity_name, new.country, new.location,
          new.record_source)
        is distinct from row(old.event_master_id, old.event_distance_id, old.official_distance_km, old.activity_name, old.country,
          old.location, old.record_source)
        or ((new.status is distinct from old.status or new.reviewed_at is distinct from old.reviewed_at) and (
          new.status is distinct from 'rejected' or old.status is distinct from 'pending'
          or not exists (select 1 from public.admin_users where user_id = auth.uid())
        )))) then
    raise exception 'Garmin provenance and measurements are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Review status and event assignment must pass through the same transaction as the record.
drop trigger protect_garmin_submission on public.record_submissions;
create trigger protect_garmin_submission before update on public.record_submissions
for each row execute function public.protect_garmin_submission();

create function public.approve_garmin_event_submission(
  p_id bigint, p_event_master_id bigint, p_event_distance_id bigint, p_official_distance numeric, p_admin_note text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  submission public.record_submissions;
  event_master public.events_master;
  route_distance numeric;
  minutes integer;
  stored public.records;
begin
  if not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select * into submission from public.record_submissions
  where id = p_id and garmin_source_key is not null and status = 'pending'
    and submission_type = 'official_event' and is_public = true
  for update;
  if not found then raise exception 'Garmin event submission is no longer pending'; end if;

  -- Match publication's connection-then-hiker lock order before the export trigger runs.
  perform 1 from public.garmin_connections c
  join public.garmin_publications p on p.source_key = decode(submission.garmin_source_key, 'hex')
    and p.submission_type = 'official_event'
    and p.connection_key = pg_catalog.sha256(pg_catalog.convert_to(c.garmin_user_id, 'UTF8'))
  where c.user_id = submission.user_id
    and c.activity_export_revoked_at is null and c.deregistered_at is null and c.disconnect_lease_until is null
  for share of c;
  if not found then raise exception 'Garmin Activity Export is unavailable' using errcode = '42501'; end if;

  perform 1 from public.hikers where id = submission.hiker_id and claimed_by_user_id = submission.user_id for update;
  if not found then raise exception 'Hiker account assignment changed'; end if;

  select e.* into event_master from public.events_master e
  where e.id = p_event_master_id and e.event_date = submission.activity_date for share;
  if not found then raise exception 'Event does not match the submission date'; end if;
  if submission.event_master_id is not null and submission.event_master_id <> p_event_master_id then
    raise exception 'Event differs from the selected calendar event';
  end if;

  select d.distance_km into route_distance from public.event_distances d
  where d.id = p_event_distance_id and d.event_id = p_event_master_id for share;
  -- Same distance matching tolerance as the manual approval workflow.
  if route_distance is null or route_distance <= 0 or p_official_distance is null
    or p_official_distance <= 0 or abs(route_distance - p_official_distance) >= 0.2
    or submission.distance_km < greatest(route_distance, p_official_distance) * 0.97
  then raise exception 'The activity must cover at least 97%% of the official event distance'; end if;

  minutes := split_part(submission.elapsed_time_text, ':', 1)::integer * 60
    + split_part(submission.elapsed_time_text, ':', 2)::integer;
  if exists (
    select 1 from public.records r where r.hiker_id = submission.hiker_id
      and r.activity_date = submission.activity_date
      and round(r.distance_km::numeric, 2) = submission.distance_km
      and (r.time_text = submission.elapsed_time_text or abs(r.time_hours::numeric * 60 - minutes) < 0.5)
  ) then raise exception 'Matching record already exists' using errcode = '23505'; end if;

  insert into public.records (
    hiker_id, event_master_id, event_distance_id, is_public, distance_km, elevation_gain,
    time_text, time_hours, avg_speed, activity_date, verified, record_status, record_source,
    is_corrected, garmin_verified
  ) values (
    submission.hiker_id, p_event_master_id, p_event_distance_id, true, submission.distance_km,
    submission.elevation_gain, submission.elapsed_time_text, minutes / 60.0,
    round(submission.distance_km::numeric * 60 / minutes, 2), submission.activity_date, true,
    'verified_admin_submission', 'Garmin', false, true
  ) returning * into stored;

  if stored.distance_km is distinct from submission.distance_km
    or stored.elevation_gain is distinct from submission.elevation_gain
    or stored.time_text is distinct from submission.elapsed_time_text
    or stored.time_hours is null or abs(stored.time_hours::numeric * 60 - minutes) >= 0.5
    or stored.avg_speed is distinct from round(submission.distance_km::numeric * 60 / minutes, 2)
    or stored.event_master_id is distinct from p_event_master_id
    or stored.event_distance_id is distinct from p_event_distance_id or stored.verified is distinct from true
  then raise exception 'Record storage changed Garmin measurements or event assignment'; end if;

  update public.record_submissions set
    event_master_id = p_event_master_id, event_distance_id = p_event_distance_id, activity_name = event_master.title,
    country = event_master.country, location = event_master.city, record_source = event_master.brand,
    official_distance_km = route_distance, status = 'approved', reviewed_at = now(), admin_note = p_admin_note
  where id = submission.id;
end;
$$;

revoke all on function public.approve_garmin_event_submission(bigint, bigint, bigint, numeric, text)
  from public, anon, authenticated, service_role;
grant execute on function public.approve_garmin_event_submission(bigint, bigint, bigint, numeric, text)
  to authenticated;
