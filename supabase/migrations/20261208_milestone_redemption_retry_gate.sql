begin;

-- Apply the global gate to completed retries as well as new redemptions.
create or replace function public.redeem_reward(p_reward_id bigint, p_request_id uuid)
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
  if not public.milestone_shop_is_live() then
    raise exception 'Der Milestone-Shop ist noch nicht freigegeben.' using errcode = '42501';
  end if;
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

commit;
