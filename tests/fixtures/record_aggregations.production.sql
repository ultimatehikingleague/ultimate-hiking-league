-- Relevant aggregation logic from the 2026-11-14 read-only catalog check.
-- Minimal local tables and supporting functions for the captured SQL below.
alter table public.hikers add column total_km numeric, add column total_elevation_gain numeric,
  add column avg_speed numeric, add column division text;
create table public.site_stats (key text primary key, value_numeric numeric, updated_at timestamptz);
create table public.reward_points_ledger (
  record_id bigint, hiker_id bigint, points integer, transaction_type text, description text
);

-- Profile division and lock implementations were outside the captured SQL.
create function public.calculate_hiker_division(bigint) returns text language sql as
  $$ select 'silver'::text $$;
create function public.reward_record_lock(bigint) returns void language plpgsql as $$ begin end; $$;
create function public.reward_hiker_lock(bigint) returns void language plpgsql as $$ begin end; $$;
create function public.reward_lock_hiker_pair(bigint, bigint) returns void language plpgsql as $$ begin end; $$;

create function public.calculate_reward_points(p_distance_km numeric) returns integer
language sql as $$
  select case
    when p_distance_km is null or p_distance_km < 0 then 0
    when p_distance_km >= 100 then floor(p_distance_km)::integer * 2
    when p_distance_km >= 30 then floor(floor(p_distance_km) * 1.5)::integer
    else floor(p_distance_km)::integer
  end;
$$;

-- Use fixture-owner privileges for trigger writes to the minimal test tables.
create function public.update_hiker_stats(p_hiker_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_total_km numeric := 0;
  v_total_elevation_gain numeric := 0;
  v_avg_speed numeric := null;
  v_division text := 'silver';
begin
  select coalesce(sum(distance_km), 0),
    coalesce(sum(elevation_gain) filter (where verified = true), 0),
    round((sum(distance_km) filter (where avg_speed is not null)
      / nullif(sum(distance_km / nullif(avg_speed, 0)) filter (where avg_speed is not null), 0))::numeric, 2)
  into v_total_km, v_total_elevation_gain, v_avg_speed
  from records where hiker_id = p_hiker_id;
  v_division := public.calculate_hiker_division(p_hiker_id);
  update hikers set total_km = v_total_km, total_elevation_gain = v_total_elevation_gain,
    avg_speed = v_avg_speed, division = v_division where id = p_hiker_id;
end;
$$;

create function public.trigger_update_hiker_stats() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform update_hiker_stats(old.hiker_id);
    return old;
  elsif tg_op = 'UPDATE' and old.hiker_id is distinct from new.hiker_id then
    perform update_hiker_stats(old.hiker_id);
  end if;
  perform update_hiker_stats(new.hiker_id);
  return new;
end;
$$;

create function public.sync_total_km_site_stats() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.site_stats
  set value_numeric = (select coalesce(sum(distance_km), 0) from public.records), updated_at = now()
  where key = 'total_km';
  return null;
end;
$$;

create function public.refresh_total_km_site_stat() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into site_stats (key, value_numeric, updated_at)
  values ('total_km', (select coalesce(sum(distance_km), 0) from records), now())
  on conflict (key) do update set value_numeric = excluded.value_numeric, updated_at = now();
  return null;
end;
$$;

create function public.sync_record_reward_points() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_new_points integer := 0;
  v_old_points integer := 0;
  v_difference integer;
  v_hiker bigint;
  v_current_points integer;
begin
  if tg_op not in ('INSERT', 'UPDATE') then raise exception 'Unsupported rewards trigger operation'; end if;
  perform public.reward_record_lock(new.id);
  if tg_op = 'UPDATE' then
    perform public.reward_lock_hiker_pair(old.hiker_id, new.hiker_id);
  else
    perform public.reward_hiker_lock(new.hiker_id);
  end if;
  if new.verified is true then v_new_points := public.calculate_reward_points(new.distance_km); end if;

  for v_hiker, v_current_points in
    select hiker_id, sum(points)::integer from public.reward_points_ledger
    where record_id = new.id and transaction_type in ('activity', 'correction') group by hiker_id
  loop
    if v_hiker <> new.hiker_id then
      if v_current_points <> 0 then
        insert into public.reward_points_ledger (hiker_id, record_id, points, transaction_type, description)
        values (v_hiker, new.id, -v_current_points, 'correction', 'Rewards-Übertragung: bisheriger Hiker');
      end if;
    else
      v_old_points := v_current_points;
    end if;
  end loop;

  v_difference := v_new_points - v_old_points;
  if v_difference <> 0 then
    if v_old_points = 0 and v_difference > 0 and not exists (
      select 1 from public.reward_points_ledger where record_id = new.id and transaction_type = 'activity'
    ) then
      insert into public.reward_points_ledger (hiker_id, record_id, points, transaction_type, description)
      values (new.hiker_id, new.id, v_difference, 'activity', 'Automatische Rewards-Gutschrift');
    else
      insert into public.reward_points_ledger (hiker_id, record_id, points, transaction_type, description)
      values (new.hiker_id, new.id, v_difference, 'correction', 'Automatische Rewards-Korrektur');
    end if;
  end if;
  return new;
end;
$$;

create view public.hiker_season_stats as
select hiker_id, extract(year from activity_date)::integer as season_year,
  round(sum(distance_km), 2) as season_km, round(sum(coalesce(elevation_gain, 0)), 0) as season_elevation_gain,
  count(*) as season_records
from records
where verified = true and activity_date >= '2026-01-01'::date
group by hiker_id, extract(year from activity_date);

create trigger trg_update_hiker_stats_on_records after insert or delete or update on public.records
for each row execute function public.trigger_update_hiker_stats();
create trigger trg_sync_total_km_site_stats after insert or delete or update on public.records
for each statement execute function public.sync_total_km_site_stats();
create trigger trg_refresh_total_km_site_stat after insert or delete or update on public.records
for each statement execute function public.refresh_total_km_site_stat();
create trigger trg_sync_record_reward_points after insert or update on public.records
for each row execute function public.sync_record_reward_points();
