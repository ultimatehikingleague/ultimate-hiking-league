alter table public.garmin_connections
  add column activity_export_revoked_at timestamptz,
  add column permissions_changed_at timestamptz,
  add column deregistered_at timestamptz;

-- Called only with a verified, complete Garmin permission snapshot.
create function public.apply_garmin_permissions(
  p_garmin_user_id text, p_change_time_seconds bigint, p_has_activity_export boolean
)
returns boolean language plpgsql set search_path = '' as $$
declare
  changed_at timestamptz;
begin
  if p_garmin_user_id is null or pg_catalog.btrim(p_garmin_user_id) = ''
    or p_has_activity_export is null or p_change_time_seconds is null
    or p_change_time_seconds <= 0
    or p_change_time_seconds > extract(epoch from pg_catalog.clock_timestamp()) then
    return false;
  end if;

  changed_at := pg_catalog.to_timestamp(p_change_time_seconds);
  update public.garmin_connections c set
    permissions_changed_at = changed_at,
    activity_export_revoked_at = case when p_has_activity_export then c.activity_export_revoked_at else changed_at end
  where c.garmin_user_id = p_garmin_user_id
    and changed_at >= pg_catalog.date_trunc('second', c.connected_at)
    and (c.permissions_changed_at is null or changed_at > c.permissions_changed_at
      or (changed_at = c.permissions_changed_at and not p_has_activity_export and c.activity_export_revoked_at is null));
  return found;
end;
$$;

revoke all on function public.apply_garmin_permissions(text, bigint, boolean) from public, anon, authenticated;
grant execute on function public.apply_garmin_permissions(text, bigint, boolean) to service_role;

drop function public.enqueue_garmin_push(text, jsonb);
create function public.enqueue_garmin_push(p_feed text, p_items jsonb, p_pilot_owner uuid)
returns void
language sql
set search_path = ''
as $$
  insert into public.garmin_push_inbox (owner_id, feed, fingerprint, payload)
  select connection.user_id, p_feed, item.fingerprint, item.payload
  from pg_catalog.jsonb_to_recordset(p_items)
    as item(garmin_user_id text, fingerprint text, payload jsonb)
  join public.garmin_connections as connection
    on connection.garmin_user_id = item.garmin_user_id
  where connection.user_id = p_pilot_owner and connection.activity_export_revoked_at is null
  for share of connection
  on conflict (owner_id, feed, fingerprint) do nothing;
$$;

drop function public.claim_garmin_push();
create function public.claim_garmin_push(p_pilot_owner uuid)
returns setof public.garmin_push_inbox
language plpgsql set search_path = '' as $$
declare job public.garmin_push_inbox;
begin
  perform pg_catalog.pg_advisory_xact_lock(20261116, 1);
  delete from public.garmin_file_claims where claimed_at < now() - interval '90 seconds';
  select * into job from public.garmin_push_inbox q
    where q.owner_id = p_pilot_owner and q.processed_at is null and (q.lease_until is null or q.lease_until < now())
      and exists (select 1 from public.garmin_connections c
        where c.user_id = q.owner_id and c.disconnect_lease_until is null and c.activity_export_revoked_at is null
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

revoke all on function public.enqueue_garmin_push(text, jsonb, uuid), public.claim_garmin_push(uuid) from public, anon, authenticated;
grant execute on function public.enqueue_garmin_push(text, jsonb, uuid), public.claim_garmin_push(uuid) to service_role;

create or replace function public.finish_garmin_push(p_id bigint, p_attempt integer, p_activity_id text, p_metrics jsonb, p_failure text)
returns void language plpgsql set search_path = '' as $$
declare job public.garmin_push_inbox;
begin
  -- Lock the connection before the job, matching claims and account cleanup.
  perform 1 from public.garmin_connections c
  join public.garmin_push_inbox q on q.owner_id = c.user_id
  where q.id = p_id and c.activity_export_revoked_at is null
  for share of c;
  if not found then return; end if;

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

-- Serialize a Garmin submission with permission changes even if its HTTP request
-- already read the connection before the revocation committed.
create function public.require_garmin_export_for_submission()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.garmin_connections
  where user_id = new.user_id and activity_export_revoked_at is null
    and disconnect_lease_until is null
  for share;
  if not found then
    raise exception 'Garmin Activity Export is unavailable' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.require_garmin_export_for_submission() from public, anon, authenticated;

create trigger require_garmin_export_for_submission
before insert on public.record_submissions
for each row when (new.garmin_source_key is not null)
execute function public.require_garmin_export_for_submission();

create trigger require_garmin_export_for_approval
before update of status on public.record_submissions
for each row when (old.garmin_source_key is not null and old.status = 'pending' and new.status = 'approved')
execute function public.require_garmin_export_for_submission();

-- Raw files are removed via the Storage API. Discover eligible objects from
-- Storage metadata so an Auth cascade or interrupted upload cannot lose them.
create function public.list_garmin_files_for_cleanup()
returns table (name text)
language sql security definer set search_path = '' as $$
  select o.name from storage.objects o
  left join public.garmin_connections c
    on c.user_id::text = pg_catalog.split_part(o.name, '/', 1)
  where o.bucket_id = 'garmin-activity-files'
    and (c.user_id is null or c.activity_export_revoked_at is not null
      or o.created_at <= now() - interval '24 hours')
  order by o.created_at, o.name limit 100;
$$;
revoke all on function public.list_garmin_files_for_cleanup() from public, anon, authenticated;
grant execute on function public.list_garmin_files_for_cleanup() to service_role;

-- The pilot stores owner-only imports. Keep the review RPC disabled so
-- no Garmin import can reach the existing record, statistics or reward triggers.
revoke execute on function public.approve_garmin_submission(bigint, jsonb, jsonb) from authenticated;

-- Prevent client-side edits from changing Garmin provenance or publishing a
-- Garmin submission left over from a local development run.
create function public.protect_garmin_submission()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.garmin_source_key is distinct from old.garmin_source_key
    or (old.garmin_source_key is not null and
      (new.is_public is distinct from false or new.submission_type is distinct from 'private')) then
    raise exception 'Garmin submission must stay private' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_garmin_submission() from public, anon, authenticated;
create trigger protect_garmin_submission
before update of garmin_source_key, is_public, submission_type on public.record_submissions
for each row execute function public.protect_garmin_submission();
