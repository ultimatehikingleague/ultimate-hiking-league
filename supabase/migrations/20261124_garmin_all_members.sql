-- Keep the pilot signatures available during the deployment and rollback window.
create function public.enqueue_garmin_push(p_feed text, p_items jsonb)
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
  where connection.activity_export_revoked_at is null and connection.deregistered_at is null
  order by connection.user_id
  for share of connection
  on conflict (owner_id, feed, fingerprint) do nothing;
$$;

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
        where c.user_id = q.owner_id and c.disconnect_lease_until is null and c.activity_export_revoked_at is null and c.deregistered_at is null
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

revoke all on function public.enqueue_garmin_push(text, jsonb), public.claim_garmin_push() from public, anon, authenticated;
grant execute on function public.enqueue_garmin_push(text, jsonb), public.claim_garmin_push() to service_role;

create function public.apply_garmin_common_push(p_feed text, p_items jsonb)
returns integer language plpgsql set search_path = '' as $$
declare
  item record;
  locked_owners uuid[];
  applied integer := 0;
begin
  if p_feed is null or p_feed not in ('deregistrations', 'userPermissionsChange') then
    raise exception 'Invalid Garmin COMMON feed';
  end if;

  -- Lock every affected grant in the same order as enqueue_garmin_push.
  select array(select c.user_id from public.garmin_connections c
  where exists (
    select 1 from pg_catalog.jsonb_array_elements(p_items) event
    where event->>'user_id' = c.garmin_user_id
  )
  order by c.user_id for update) into locked_owners;

  if p_feed = 'deregistrations' then
    -- Garmin supplies only the account ID. Revoke the current matching grant.
    update public.garmin_connections c set
      deregistered_at = pg_catalog.clock_timestamp(),
      activity_export_revoked_at = coalesce(c.activity_export_revoked_at, pg_catalog.clock_timestamp())
    where c.deregistered_at is null and c.user_id = any(locked_owners);
    get diagnostics applied = row_count;
    return applied;
  end if;

  for item in
    select event.user_id, event.change_time_seconds, event.has_activity_export
    from pg_catalog.jsonb_to_recordset(p_items)
      as event(user_id text, change_time_seconds bigint, has_activity_export boolean)
    join public.garmin_connections c on c.garmin_user_id = event.user_id
    where c.user_id = any(locked_owners)
    order by event.user_id, event.change_time_seconds desc, event.has_activity_export asc
  loop
    if public.apply_garmin_permissions(item.user_id, item.change_time_seconds, item.has_activity_export) then
      applied := applied + 1;
    end if;
  end loop;
  return applied;
end;
$$;

revoke all on function public.apply_garmin_common_push(text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_garmin_common_push(text, jsonb) to service_role;
