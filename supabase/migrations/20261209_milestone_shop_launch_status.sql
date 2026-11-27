begin;

-- Keep the scheduled instant in a single predicate used by the existing access gate.
create function public.milestone_shop_launch_status()
returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select case
      when pg_catalog.statement_timestamp() < timestamptz '2026-12-01 00:01:00 Europe/Berlin' then 'scheduled'
      when emergency_closed then 'closed'
      else 'open'
    end
    from public.milestone_shop_settings
    where id = true
  ), 'closed');
$$;

revoke all on function public.milestone_shop_launch_status() from public, anon;
grant execute on function public.milestone_shop_launch_status() to authenticated;

create or replace function public.milestone_shop_is_live()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.milestone_shop_launch_status() = 'open';
$$;

commit;
