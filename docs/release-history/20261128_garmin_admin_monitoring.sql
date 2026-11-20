begin;

create index garmin_published_records_created_idx on public.records (created_at desc nulls last, id desc)
where garmin_verified and verified and is_public is true;

create index garmin_pending_events_created_idx on public.record_submissions (created_at)
where garmin_source_key is not null and submission_type = 'official_event' and status = 'pending';

create function public.garmin_admin_monitoring(p_days integer)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  berlin_today date := (now() at time zone 'Europe/Berlin')::date;
  today_start timestamptz := berlin_today::timestamp at time zone 'Europe/Berlin';
  since timestamptz;
begin
  if not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_days is null or p_days not in (0, 1, 7, 30) then
    raise exception 'Invalid monitoring period' using errcode = '22023';
  end if;
  if p_days > 0 then
    since := (berlin_today - (p_days - 1))::timestamp at time zone 'Europe/Berlin';
  end if;

  return (
    with connection_counts as (
      select count(*) filter (
          where deregistered_at is null and activity_export_revoked_at is null
            and disconnect_lease_until is null
        ) as active,
        count(*) filter (where deregistered_at is null) as registered,
        count(*) filter (where deregistered_at is not null) as retained_deregistered
      from public.garmin_connections
    ), publication_counts as (
      select count(*) filter (where event_master_id is null) as private_published,
        count(*) filter (where event_master_id is not null) as event_published,
        count(*) filter (where created_at >= today_start) as published_today,
        coalesce(sum(distance_km), 0) as distance_km,
        coalesce(sum(elevation_gain) filter (where elevation_gain > 0), 0) as elevation_gain
      from public.records
      where garmin_verified and verified and is_public is true
        and (since is null or created_at >= since)
    ), pending as (
      select count(*) as event_pending
      from public.record_submissions
      where garmin_source_key is not null and submission_type = 'official_event' and status = 'pending'
        and (since is null or created_at >= since)
    ), recent as (
      select id, hiker_id, created_at, activity_date, distance_km, event_master_id
      from public.records
      where garmin_verified and verified and is_public is true
        and (since is null or created_at >= since)
      order by created_at desc nulls last, id desc
      limit 12
    )
    select to_jsonb(connection_counts) || to_jsonb(publication_counts) || to_jsonb(pending)
      || jsonb_build_object('recent', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', r.id,
          'hiker_id', r.hiker_id,
          'hiker_name', h.display_name,
          'published_at', r.created_at,
          'activity_date', r.activity_date,
          'distance_km', r.distance_km,
          'device_model', a.device_model,
          'is_event', r.event_master_id is not null
        ) order by r.created_at desc nulls last, r.id desc), '[]'::jsonb)
        from recent r
        left join public.hikers h on h.id = r.hiker_id
        left join public.garmin_record_attributions a on a.record_id = r.id
      ))
    from connection_counts, publication_counts, pending
  );
end;
$$;

revoke all on function public.garmin_admin_monitoring(integer) from public, anon, authenticated, service_role;
grant execute on function public.garmin_admin_monitoring(integer) to authenticated;

commit;
