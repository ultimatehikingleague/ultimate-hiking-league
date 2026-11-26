begin;

alter table public.reward_catalog add column redeem_until timestamptz
  check (redeem_until is null or pg_catalog.isfinite(redeem_until));

alter table public.reward_redemptions
  add column request_user_id uuid,
  add column request_id uuid,
  add column remaining_points_after bigint,
  add constraint milestone_redemption_request_complete
    check (num_nonnulls(request_user_id, request_id, remaining_points_after) in (0, 3));

create unique index milestone_redemption_request_key
  on public.reward_redemptions (request_user_id, request_id) where request_id is not null;

-- The existing transaction is callable only from the new protected entry point.
alter function public.redeem_reward(bigint) set schema milestone_private;
revoke all on function milestone_private.redeem_reward(bigint) from public, anon, authenticated, service_role;

create function public.redeem_reward(p_reward_id bigint, p_request_id uuid)
returns table (redemption_id bigint, voucher_code text, remaining_points bigint)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_hiker_id bigint;
  v_previous record;
  v_offer record;
  v_result record;
begin
  if v_user_id is null then raise exception 'Anmeldung erforderlich.' using errcode = '42501'; end if;
  if p_request_id is null then raise exception 'Transaktionskennung fehlt.' using errcode = '22023'; end if;
  select h.id into v_hiker_id from public.hikers h
    where h.claimed_by_user_id = v_user_id and h.claimed_profile is true;
  if v_hiker_id is null then raise exception 'Kein beanspruchtes Hiker-Profil gefunden.'; end if;

  -- Same lock order as the original transaction: hiker, reward, voucher.
  perform public.reward_hiker_lock(v_hiker_id);
  select r.id, r.hiker_id, r.reward_id, vc.code, r.remaining_points_after into v_previous
    from public.reward_redemptions r
    left join public.reward_voucher_codes vc on vc.id = r.voucher_code_id and vc.assigned_hiker_id = v_hiker_id
    where r.request_user_id = v_user_id and r.request_id = p_request_id;
  if found then
    if v_previous.hiker_id is distinct from v_hiker_id or v_previous.reward_id is distinct from p_reward_id then
      raise exception 'Transaktionskennung gehört zu einer anderen Einlösung.' using errcode = '22023';
    end if;
    return query select v_previous.id, v_previous.code, v_previous.remaining_points_after;
    return;
  end if;

  if not public.milestone_shop_is_live() then
    raise exception 'Der Milestone-Shop ist noch nicht freigegeben.' using errcode = '42501';
  end if;
  select r.redeem_until into v_offer from public.reward_catalog r
    where r.id = p_reward_id and r.is_active is true for update;
  if not found or v_offer.redeem_until <= pg_catalog.clock_timestamp() then
    raise exception 'Reward nicht verfügbar.';
  end if;

  select * into strict v_result from milestone_private.redeem_reward(p_reward_id);
  update public.reward_redemptions r
    set request_user_id = v_user_id, request_id = p_request_id,
        remaining_points_after = v_result.remaining_points
    where r.id = v_result.redemption_id;
  return query select v_result.redemption_id, v_result.voucher_code, v_result.remaining_points;
end;
$$;
revoke all on function public.redeem_reward(bigint, uuid) from public, anon;
grant execute on function public.redeem_reward(bigint, uuid) to authenticated;

create or replace function public.get_milestone_shop_catalog_with_stock()
returns table (id bigint, title text, description text, partner_name text, reward_type text,
  points_cost integer, image_url text, is_available boolean)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.title, r.description, r.partner_name, r.reward_type, r.points_cost, r.image_url,
    exists (select 1 from public.reward_voucher_codes vc where vc.reward_id = r.id and vc.is_assigned = false)
  from public.reward_catalog r
  where r.is_active and auth.uid() is not null
    and (r.redeem_until is null or r.redeem_until > pg_catalog.statement_timestamp())
    and (public.milestone_shop_is_live()
      or exists (select 1 from public.admin_users where user_id = auth.uid()))
  order by r.points_cost, r.id;
$$;

-- Apply the same deadline to direct catalogue reads while retaining admin access.
create policy milestone_catalog_deadline on public.reward_catalog as restrictive
  for select to anon, authenticated
  using (redeem_until is null or redeem_until > pg_catalog.statement_timestamp()
    or exists (select 1 from public.admin_users where user_id = auth.uid()));

-- The application uses the stock-aware catalogue. Retire the unused pre-stock RPC
-- so it cannot expose offers independently of the deadline.
do $$
begin
  if pg_catalog.to_regprocedure('public.get_milestone_shop_catalog()') is not null then
    revoke execute on function public.get_milestone_shop_catalog() from public, anon, authenticated;
  end if;
end;
$$;

create or replace function public.save_positioned_milestone_reward(
  p_id bigint, p_position integer, p_reward jsonb
) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  reward public.reward_catalog;
  reward_id bigint;
  target_position integer;
  last_position integer;
begin
  if not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'Admin-Zugriff erforderlich.' using errcode = '42501';
  end if;
  if p_position is not null and p_position < 1 then
    raise exception 'Die Position muss mindestens 1 sein.' using errcode = '22023';
  end if;

  lock table public.reward_catalog in share row exclusive mode;
  select count(*)::integer + 1 into last_position
    from public.reward_catalog where id is distinct from p_id;
  if p_id is not null then
    select row_position into target_position from (
      select id, row_number() over (order by display_position nulls last, points_cost, id)::integer as row_position
      from public.reward_catalog
    ) ranked where id = p_id;
    if not found then raise exception 'Prämie nicht gefunden.' using errcode = 'P0002'; end if;
  end if;
  target_position := least(coalesce(p_position, target_position, last_position), last_position);

  reward := jsonb_populate_record(null::public.reward_catalog, p_reward);
  if p_id is null then
    insert into public.reward_catalog (
      title, partner_name, reward_type, points_cost, description, image_url,
      is_active, redemption_url, redemption_instructions, redeem_until
    ) values (
      reward.title, reward.partner_name, reward.reward_type, reward.points_cost, reward.description,
      reward.image_url, reward.is_active, reward.redemption_url, reward.redemption_instructions, reward.redeem_until
    ) returning id into reward_id;
  else
    update public.reward_catalog set
      title = reward.title, partner_name = reward.partner_name, reward_type = reward.reward_type,
      points_cost = reward.points_cost, description = reward.description, image_url = reward.image_url,
      is_active = reward.is_active, redemption_url = reward.redemption_url,
      redemption_instructions = reward.redemption_instructions,
      redeem_until = case when p_reward ? 'redeem_until' then reward.redeem_until else redeem_until end,
      updated_at = now()
    where id = p_id returning id into reward_id;
  end if;

  with ranked as (
    select id, row_number() over (order by display_position nulls last, points_cost, id)::integer as position
    from public.reward_catalog where id <> reward_id
  ), reordered as (
    select id, position + (position >= target_position)::integer as position from ranked
    union all select reward_id, target_position
  )
  update public.reward_catalog r set display_position = reordered.position
    from reordered where reordered.id = r.id and r.display_position is distinct from reordered.position;

  return reward_id;
end;
$$;

create or replace function public.get_ordered_milestone_shop_catalog() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg((to_jsonb(c) - 'ordinality') || jsonb_build_object(
    'redemption_url', r.redemption_url,
    'redemption_instructions', r.redemption_instructions,
    'redeem_until', r.redeem_until)
    order by r.display_position nulls last, c.ordinality), '[]'::jsonb)
  from public.get_milestone_shop_catalog_with_stock() with ordinality as c
  join public.reward_catalog r on r.id = c.id
  where auth.uid() is not null
    and (public.milestone_shop_is_live()
      or exists (select 1 from public.admin_users where user_id = auth.uid()));
$$;

notify pgrst, 'reload schema';

commit;
