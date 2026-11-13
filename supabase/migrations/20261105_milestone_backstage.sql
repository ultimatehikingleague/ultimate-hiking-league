begin;
create table if not exists public.milestone_shop_settings (
 id boolean primary key default true check (id),
 is_live boolean not null default false,
 updated_at timestamptz not null default now()
);
insert into public.milestone_shop_settings(id,is_live) values(true,false) on conflict(id) do nothing;
alter table public.milestone_shop_settings enable row level security;
revoke all on public.milestone_shop_settings from public,anon,authenticated;
create or replace function public.milestone_shop_is_live() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select is_live from public.milestone_shop_settings where id=true),false);
$$;
revoke all on function public.milestone_shop_is_live() from public;
grant execute on function public.milestone_shop_is_live() to anon,authenticated,service_role;
create or replace function public.set_milestone_shop_live(p_live boolean) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'Admin-Zugriff erforderlich.' using errcode='42501'; end if;
 if p_live is null then raise exception 'Freigabestatus fehlt.'; end if;
 update public.milestone_shop_settings set is_live=p_live,updated_at=now() where id=true;
 return p_live;
end;
$$;
revoke all on function public.set_milestone_shop_live(boolean) from public,anon;
grant execute on function public.set_milestone_shop_live(boolean) to authenticated;
-- Retain exact original function definitions for review/rollback, inaccessible to browser users.
create schema if not exists milestone_private;
revoke all on schema milestone_private from public,anon,authenticated;
create table if not exists milestone_private.function_backups(signature text primary key, definition text not null);
alter table milestone_private.function_backups enable row level security;
do $migration$
declare f record; definition text; source text; guard text;
begin
 for f in select p.oid,p.proname,p.prosrc,l.lanname from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
 where n.nspname='public' and p.proname in ('get_milestone_shop_catalog','get_milestone_shop_catalog_with_stock','get_my_milestone_balance','get_my_reward_redemptions','redeem_reward') loop
  definition:=pg_get_functiondef(f.oid);
  insert into milestone_private.function_backups values(f.oid::regprocedure::text,definition) on conflict do nothing;
  if position('milestone_shop_is_live' in f.prosrc)>0 then continue; end if;
  if f.proname='redeem_reward' then
   guard:='IF NOT public.milestone_shop_is_live() THEN RAISE EXCEPTION ''Der Milestone-Shop ist noch nicht freigegeben.'' USING ERRCODE=''42501''; END IF;';
  else
   guard:='IF NOT public.milestone_shop_is_live() AND NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id=auth.uid()) THEN RAISE EXCEPTION ''Der Milestone-Shop ist noch nicht freigegeben.'' USING ERRCODE=''42501''; END IF;';
  end if;
  if f.lanname='plpgsql' then
   source:=regexp_replace(f.prosrc,'\mBEGIN\M','BEGIN '||guard,'i');
  elsif f.lanname='sql' then
   source:='SELECT * FROM ('||regexp_replace(btrim(f.prosrc),';\s*$','')||') AS milestone_gated WHERE public.milestone_shop_is_live() OR EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=auth.uid());';
  else raise exception 'Unexpected function language: %',f.proname;
  end if;
  if source=f.prosrc then raise exception 'Guard injection failed: %',f.proname; end if;
  execute replace(definition,f.prosrc,source);
 end loop;
end;
$migration$;
-- Restrictive policies also protect direct reads if permissive policies are added later.
create policy milestone_catalog_launch_gate on public.reward_catalog as restrictive for select to anon,authenticated using(public.milestone_shop_is_live() or exists(select 1 from public.admin_users where user_id=auth.uid()));
create policy milestone_ledger_launch_gate on public.reward_points_ledger as restrictive for select to anon,authenticated using(public.milestone_shop_is_live() or exists(select 1 from public.admin_users where user_id=auth.uid()));
create policy milestone_redemptions_launch_gate on public.reward_redemptions as restrictive for select to anon,authenticated using(public.milestone_shop_is_live() or exists(select 1 from public.admin_users where user_id=auth.uid()));
commit;
