create function public.submit_garmin_activity(
  p_owner uuid, p_hiker_id bigint, p_activity_id text, p_connection_id text,
  p_connected_at timestamptz, p_values jsonb
)
returns text language plpgsql set search_path = '' as $$
declare
  entry public.record_submissions := pg_catalog.jsonb_populate_record(null::public.record_submissions, p_values);
begin
  perform 1 from public.garmin_connections
  where user_id = p_owner and garmin_user_id = p_connection_id and connected_at = p_connected_at
    and activity_export_revoked_at is null and disconnect_lease_until is null
  for share;
  if not found then return 'revoked'; end if;

  perform 1 from public.hikers where id = p_hiker_id and claimed_by_user_id = p_owner for share;
  if not found then return 'not-found'; end if;
  perform 1 from public.garmin_activities where owner_id = p_owner and activity_id = p_activity_id;
  if not found then return 'not-found'; end if;

  if entry.activity_date is null or entry.distance_km is null or entry.distance_km <= 0
    or (entry.distance_km < 10 and coalesce(entry.elevation_gain, 0) < 600)
    or (entry.elapsed_time_text is not null and entry.elapsed_time_text !~ '^[0-9]{2,}:[0-5][0-9]$')
  then return 'ineligible'; end if;

  insert into public.record_submissions (
    user_id, hiker_id, garmin_source_key, proof_image_url, submission_type, is_public,
    activity_name, description, activity_date, actual_distance_km, distance_km,
    elapsed_time_text, elevation_gain, country, location, record_source, notes, status
  ) values (
    p_owner, p_hiker_id, entry.garmin_source_key, 'garmin-activity:' || entry.garmin_source_key, 'private', false,
    'Private Wanderung', entry.description, entry.activity_date, entry.distance_km, entry.distance_km,
    entry.elapsed_time_text, entry.elevation_gain, entry.country, entry.location, 'Garmin', entry.notes, 'pending'
  )
  on conflict (user_id, garmin_source_key) where garmin_source_key is not null do nothing;
  if not found then return 'already-submitted'; end if;
  return 'submitted';
end;
$$;

revoke all on function public.submit_garmin_activity(uuid, bigint, text, text, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_garmin_activity(uuid, bigint, text, text, timestamptz, jsonb)
  to service_role;

-- A browser-supplied proof URL cannot claim Garmin provenance.
create policy record_submissions_garmin_proof_insert on public.record_submissions
as restrictive for insert to anon, authenticated
with check (proof_image_url is null or proof_image_url not like 'garmin-activity:%');

create or replace function public.protect_garmin_submission()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.garmin_source_key is distinct from old.garmin_source_key
    or (new.garmin_source_key is null and new.proof_image_url like 'garmin-activity:%')
    or (old.garmin_source_key is not null and (
      new.is_public is distinct from false or new.submission_type is distinct from 'private'
      or new.proof_image_url is distinct from old.proof_image_url
      or new.user_id is distinct from old.user_id or new.hiker_id is distinct from old.hiker_id
      or new.activity_date is distinct from old.activity_date
      or new.distance_km is distinct from old.distance_km
      or new.actual_distance_km is distinct from old.actual_distance_km
      or new.elevation_gain is distinct from old.elevation_gain
      or new.elapsed_time_text is distinct from old.elapsed_time_text
    )) then
    raise exception 'Garmin provenance and measurements are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger protect_garmin_submission on public.record_submissions;
create trigger protect_garmin_submission
before update of garmin_source_key, proof_image_url, is_public, submission_type,
  user_id, hiker_id, activity_date, distance_km, actual_distance_km, elevation_gain, elapsed_time_text
on public.record_submissions for each row execute function public.protect_garmin_submission();

-- Review in place while the pilot has no approved publication path through records.
drop function public.approve_garmin_submission(bigint, jsonb, jsonb);
create function public.approve_garmin_submission(p_id bigint, p_review jsonb)
returns void language plpgsql set search_path = '' as $$
declare
  submission public.record_submissions;
  reviewed public.record_submissions := pg_catalog.jsonb_populate_record(null::public.record_submissions, p_review);
begin
  if not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select * into submission from public.record_submissions
  where id = p_id and garmin_source_key is not null and status = 'pending'
    and submission_type = 'private' and is_public = false
  for update;
  if not found then
    raise exception 'Garmin submission is no longer pending';
  end if;

  if submission.activity_date is null or submission.distance_km is null or submission.distance_km <= 0
    or (submission.distance_km < 10 and coalesce(submission.elevation_gain, 0) < 600)
    or (submission.elapsed_time_text is not null and submission.elapsed_time_text !~ '^[0-9]{2,}:[0-5][0-9]$')
    or not exists (select 1 from public.hikers where id = submission.hiker_id and claimed_by_user_id = submission.user_id)
  then
    raise exception 'Garmin submission is ineligible';
  end if;

  update public.record_submissions set
    description = reviewed.description, country = reviewed.country, location = reviewed.location,
    record_source = 'Garmin', notes = reviewed.notes, admin_note = reviewed.admin_note,
    status = 'approved', reviewed_at = now()
  where id = submission.id;
  if not found then
    raise exception 'Garmin submission could not be updated';
  end if;
end;
$$;

revoke all on function public.approve_garmin_submission(bigint, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.approve_garmin_submission(bigint, jsonb) to authenticated;
