begin;

alter table public.reward_catalog add column display_position integer
  check (display_position > 0);

with ranked as (
  select id, row_number() over (order by points_cost, id) as position
  from public.reward_catalog
)
update public.reward_catalog r set display_position = ranked.position
from ranked where ranked.id = r.id;

alter table public.reward_catalog add constraint reward_catalog_display_position_key
  unique (display_position) deferrable initially deferred;

create function public.save_positioned_milestone_reward(
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
      is_active, redemption_url, redemption_instructions
    ) values (
      reward.title, reward.partner_name, reward.reward_type, reward.points_cost, reward.description,
      reward.image_url, reward.is_active, reward.redemption_url, reward.redemption_instructions
    ) returning id into reward_id;
  else
    update public.reward_catalog set
      title = reward.title, partner_name = reward.partner_name, reward_type = reward.reward_type,
      points_cost = reward.points_cost, description = reward.description, image_url = reward.image_url,
      is_active = reward.is_active, redemption_url = reward.redemption_url,
      redemption_instructions = reward.redemption_instructions, updated_at = now()
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

revoke all on function public.save_positioned_milestone_reward(bigint, integer, jsonb) from public, anon;
grant execute on function public.save_positioned_milestone_reward(bigint, integer, jsonb) to authenticated;

create function public.get_ordered_milestone_shop_catalog() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(c) - 'ordinality'
    order by r.display_position nulls last, c.ordinality), '[]'::jsonb)
  from public.get_milestone_shop_catalog_with_stock() with ordinality as c
  join public.reward_catalog r on r.id = c.id
  where auth.uid() is not null
    and (public.milestone_shop_is_live()
      or exists (select 1 from public.admin_users where user_id = auth.uid()));
$$;

revoke all on function public.get_ordered_milestone_shop_catalog() from public, anon;
grant execute on function public.get_ordered_milestone_shop_catalog() to authenticated;

commit;
