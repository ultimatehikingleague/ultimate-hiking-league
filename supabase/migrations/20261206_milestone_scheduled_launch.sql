begin;

alter table public.milestone_shop_settings
  add column emergency_closed boolean not null default false;

create or replace function public.milestone_shop_is_live()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select not emergency_closed
      and pg_catalog.statement_timestamp() >= timestamptz '2026-12-01 00:01:00 Europe/Berlin'
    from public.milestone_shop_settings
    where id = true
  ), false);
$$;

-- Keep the existing admin action and its authorization, but never allow early opening.
create or replace function public.set_milestone_shop_live(p_live boolean)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists(select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'Admin-Zugriff erforderlich.' using errcode = '42501';
  end if;
  if p_live is null then raise exception 'Freigabestatus fehlt.'; end if;
  update public.milestone_shop_settings
  set emergency_closed = not p_live, updated_at = pg_catalog.statement_timestamp()
  where id = true;
  return public.milestone_shop_is_live();
end;
$$;

create function public.milestone_shop_emergency_closed()
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not exists(select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'Admin-Zugriff erforderlich.' using errcode = '42501';
  end if;
  return coalesce((select emergency_closed from public.milestone_shop_settings where id = true), true);
end;
$$;

revoke all on function public.milestone_shop_emergency_closed() from public, anon;
grant execute on function public.milestone_shop_emergency_closed() to authenticated;

commit;
