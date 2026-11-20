-- Acknowledge only after the pilot's connection state has been committed.
-- The connection row lock serializes this with imports and publication.
create function public.apply_garmin_common_push(p_feed text, p_items jsonb, p_pilot_owner uuid)
returns integer language plpgsql set search_path = '' as $$
declare
  linked_user text;
  item record;
  applied integer := 0;
begin
  if p_feed is null or p_feed not in ('deregistrations', 'userPermissionsChange') then
    raise exception 'Invalid Garmin COMMON feed';
  end if;

  select c.garmin_user_id into linked_user
  from public.garmin_connections c
  where c.user_id = p_pilot_owner
    and exists (
      select 1 from pg_catalog.jsonb_array_elements(p_items) event
      where event->>'user_id' = c.garmin_user_id
    )
  for update;
  if not found then return 0; end if;

  if p_feed = 'deregistrations' then
    -- Garmin sends only the user ID, with no registration ID or event time.
    -- Fail closed for the current matching grant.
    update public.garmin_connections set
      deregistered_at = pg_catalog.clock_timestamp(),
      activity_export_revoked_at = coalesce(activity_export_revoked_at, pg_catalog.clock_timestamp())
    where user_id = p_pilot_owner and deregistered_at is null;
    return case when found then 1 else 0 end;
  end if;

  for item in
    select change_time_seconds, has_activity_export
    from pg_catalog.jsonb_to_recordset(p_items)
      as event(user_id text, change_time_seconds bigint, has_activity_export boolean)
    where user_id = linked_user
    order by change_time_seconds desc, has_activity_export asc
  loop
    if public.apply_garmin_permissions(linked_user, item.change_time_seconds, item.has_activity_export) then
      applied := applied + 1;
    end if;
  end loop;
  return applied;
end;
$$;

revoke all on function public.apply_garmin_common_push(text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.apply_garmin_common_push(text, jsonb, uuid) to service_role;
