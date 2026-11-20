alter table public.garmin_connections add column disconnect_lease_until timestamptz;
grant update, delete on public.garmin_connections to service_role;

alter table public.garmin_push_inbox
  add column attempts integer not null default 0,
  add column lease_until timestamptz,
  add column processed_at timestamptz,
  add column failure text;

create index garmin_push_pending_idx on public.garmin_push_inbox (received_at)
where processed_at is null;
grant update on public.garmin_push_inbox to service_role;

create table public.garmin_activities (
  owner_id uuid not null references public.garmin_connections(user_id) on delete cascade,
  activity_id text not null,
  summary jsonb not null default '{}',
  details jsonb not null default '{}',
  file_metrics jsonb not null default '{}',
  primary key (owner_id, activity_id)
);

alter table public.garmin_activities enable row level security;
revoke all on public.garmin_activities from public, anon, authenticated;
grant select, insert, update on public.garmin_activities to service_role;

insert into storage.buckets (id, name, public) values ('garmin-activity-files', 'garmin-activity-files', false);
create policy garmin_files_server_only on storage.objects
as restrictive for all to anon, authenticated
using (bucket_id <> 'garmin-activity-files')
with check (bucket_id <> 'garmin-activity-files');

create table public.garmin_file_claims (claimed_at timestamptz not null);
alter table public.garmin_file_claims enable row level security;
revoke all on public.garmin_file_claims from public, anon, authenticated;
grant select, insert, delete on public.garmin_file_claims to service_role;

create function public.claim_garmin_push()
returns setof public.garmin_push_inbox
language plpgsql set search_path = '' as $$
declare job public.garmin_push_inbox;
begin
  perform pg_catalog.pg_advisory_xact_lock(20261116, 1);
  delete from public.garmin_file_claims where claimed_at < now() - interval '90 seconds';
  select * into job from public.garmin_push_inbox q
    where q.processed_at is null and (q.lease_until is null or q.lease_until < now())
      and exists (select 1 from public.garmin_connections c
        where c.user_id = q.owner_id and c.disconnect_lease_until is null
        for share)
      and (q.feed <> 'activityFiles' or (select count(*) from public.garmin_file_claims) < 50)
    order by (q.feed = 'activityFiles') desc, q.received_at, q.id
    for update skip locked limit 1;
  if not found then return; end if;
  if job.feed = 'activityFiles' then
    insert into public.garmin_file_claims values (now());
  end if;
  return query update public.garmin_push_inbox q
    set lease_until = now() + interval '3 minutes', attempts = q.attempts + 1
    where q.id = job.id returning q.*;
end;
$$;

create function public.finish_garmin_push(p_id bigint, p_attempt integer, p_activity_id text, p_metrics jsonb, p_failure text)
returns void language plpgsql set search_path = '' as $$
declare job public.garmin_push_inbox;
begin
  select * into job from public.garmin_push_inbox
    where id = p_id and attempts = p_attempt and processed_at is null for update;
  if not found then return; end if;
  -- Disconnect waits for in-flight jobs. A transient disconnect lease must not discard their results.
  if p_activity_id is not null then
    insert into public.garmin_activities (owner_id, activity_id, summary, details, file_metrics)
    values (job.owner_id, p_activity_id,
      case when job.feed = 'activities' then p_metrics else '{}'::jsonb end,
      case when job.feed = 'activityDetails' then p_metrics else '{}'::jsonb end,
      case when job.feed = 'activityFiles' then p_metrics else '{}'::jsonb end)
    on conflict (owner_id, activity_id) do update set
      summary = public.garmin_activities.summary || excluded.summary,
      details = public.garmin_activities.details || excluded.details,
      file_metrics = public.garmin_activities.file_metrics || excluded.file_metrics;
  end if;
  update public.garmin_push_inbox
    set processed_at = now(), payload = '{}', failure = p_failure
    where id = job.id;
end;
$$;

revoke all on function public.claim_garmin_push(), public.finish_garmin_push(bigint, integer, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.claim_garmin_push(), public.finish_garmin_push(bigint, integer, text, jsonb, text) to service_role;

alter table public.record_submissions add column garmin_source_key text;
create unique index record_submissions_garmin_source_idx
on public.record_submissions (user_id, garmin_source_key) where garmin_source_key is not null;

-- Browser clients may continue to submit all existing sources, but cannot forge Garmin provenance.
create policy record_submissions_garmin_server_only on public.record_submissions
as restrictive for insert to anon, authenticated with check (garmin_source_key is null);

-- Keep the existing admin review screen and RLS, but commit both Garmin writes together.
create function public.approve_garmin_submission(p_id bigint, p_record jsonb, p_review jsonb)
returns void language plpgsql set search_path = '' as $$
declare
  submission public.record_submissions;
  reviewed public.record_submissions := pg_catalog.jsonb_populate_record(null::public.record_submissions, p_review);
  hike public.records := pg_catalog.jsonb_populate_record(null::public.records, p_record);
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

  insert into public.records (
    hiker_id, is_public, distance_km, time_hours, avg_speed, activity_date,
    record_status, verified, time_text, record_source, is_corrected, elevation_gain,
    custom_title, custom_location, custom_country
  ) values (
    submission.hiker_id, false, hike.distance_km, hike.time_hours, hike.avg_speed, hike.activity_date,
    'verified_admin_submission', true, hike.time_text, 'Garmin', false, hike.elevation_gain,
    hike.custom_title, hike.custom_location, hike.custom_country
  );

  update public.record_submissions set
    activity_name = 'Private Wanderung', description = reviewed.description,
    activity_date = reviewed.activity_date, actual_distance_km = hike.distance_km,
    distance_km = hike.distance_km, elapsed_time_text = hike.time_text, elevation_gain = hike.elevation_gain,
    country = reviewed.country, location = reviewed.location, record_source = 'Garmin',
    notes = reviewed.notes, admin_note = reviewed.admin_note, status = 'approved', reviewed_at = now()
  where id = submission.id;
  if not found then
    raise exception 'Garmin submission could not be updated';
  end if;
end;
$$;

revoke all on function public.approve_garmin_submission(bigint, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.approve_garmin_submission(bigint, jsonb, jsonb) to authenticated;
