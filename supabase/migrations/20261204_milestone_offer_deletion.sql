begin;

-- Private, independent recovery copy: deliberately no cascading foreign keys.
create table public.milestone_offer_deletion_backups (
  id bigint generated always as identity primary key,
  backed_up_at timestamptz not null default clock_timestamp(),
  deleted_by uuid not null,
  offer_table text not null check (offer_table in ('reward_catalog', 'milestone_partner_benefits')),
  offer_id bigint not null,
  offer jsonb not null,
  voucher_codes jsonb not null
);
alter table public.milestone_offer_deletion_backups enable row level security;
revoke all on public.milestone_offer_deletion_backups from public, anon, authenticated, service_role;
revoke all on sequence public.milestone_offer_deletion_backups_id_seq from public, anon, authenticated, service_role;

create function public.delete_inactive_milestone_offer(
  p_offer_table text, p_id bigint, p_confirm boolean default false
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  offer_snapshot jsonb;
  codes_snapshot jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.admin_users where user_id = auth.uid()
  ) then
    raise exception 'Admin-Zugriff erforderlich.' using errcode = '42501';
  end if;
  if p_confirm is distinct from true then
    raise exception 'Die endgültige Löschung muss ausdrücklich bestätigt werden.' using errcode = '22023';
  end if;
  if p_offer_table is null or p_offer_table not in ('reward_catalog', 'milestone_partner_benefits') or p_id is null then
    raise exception 'Ungültiges Angebot.' using errcode = '22023';
  end if;

  if p_offer_table = 'reward_catalog' then
    -- Serialize this rare admin operation with all writes to the affected tables.
    -- Includes activation, code import/assignment and historical redemption inserts.
    lock table public.reward_catalog, public.reward_voucher_codes, public.reward_redemptions
      in share row exclusive mode;
    select to_jsonb(r) into offer_snapshot from public.reward_catalog r where id = p_id;
  else
    lock table public.milestone_partner_benefits in share row exclusive mode;
    select to_jsonb(b) into offer_snapshot from public.milestone_partner_benefits b where id = p_id;
  end if;
  if offer_snapshot is null then
    raise exception 'Angebot nicht gefunden. Bitte die Seite neu laden.' using errcode = 'P0002';
  end if;
  if (offer_snapshot->>'is_active')::boolean is distinct from false then
    raise exception 'Aktive Angebote müssen zuerst deaktiviert werden.' using errcode = '55000';
  end if;

  -- Fail closed if future schema changes introduce unknown dependants or cascades.
  if exists (
    select 1 from pg_catalog.pg_constraint c where c.contype = 'f' and (
      (p_offer_table = 'milestone_partner_benefits' and c.confrelid = 'public.milestone_partner_benefits'::regclass)
      or (p_offer_table = 'reward_catalog' and (
        (c.confrelid = 'public.reward_catalog'::regclass and (
          c.conrelid not in ('public.reward_voucher_codes'::regclass, 'public.reward_redemptions'::regclass)
          or c.confdeltype not in ('a', 'r')))
        or (c.confrelid = 'public.reward_voucher_codes'::regclass and (
          c.conrelid <> 'public.reward_redemptions'::regclass or c.confdeltype not in ('a', 'r')))
      ))
    )
  ) then
    raise exception 'Weitere Datenbankabhängigkeiten müssen vor einer Löschung geprüft werden.' using errcode = '55000';
  end if;

  if p_offer_table = 'reward_catalog' then
    -- No status filter: cancelled/fulfilled/older redemptions also block deletion.
    if exists (select 1 from public.reward_redemptions r where r.reward_id = p_id)
      or exists (
        select 1 from public.reward_redemptions r
        join public.reward_voucher_codes v on v.id = r.voucher_code_id where v.reward_id = p_id
      ) then
      raise exception 'Angebote mit bestehenden oder historischen Einlösungen dürfen nicht gelöscht werden.' using errcode = '55000';
    end if;
    if exists (
      select 1 from public.reward_voucher_codes where reward_id = p_id
        and (is_assigned is distinct from false or assigned_hiker_id is not null or assigned_at is not null)
    ) then
      raise exception 'Angebote mit bereits zugewiesenen Gutscheincodes dürfen nicht gelöscht werden.' using errcode = '55000';
    end if;
    select coalesce(jsonb_agg(to_jsonb(v) order by v.id), '[]'::jsonb) into codes_snapshot
      from public.reward_voucher_codes v where reward_id = p_id;
  end if;

  -- Fresh backup and deletion commit together; any failure rolls both back.
  insert into public.milestone_offer_deletion_backups(deleted_by, offer_table, offer_id, offer, voucher_codes)
    values(auth.uid(), p_offer_table, p_id, offer_snapshot, codes_snapshot);
  if p_offer_table = 'reward_catalog' then
    delete from public.reward_voucher_codes where reward_id = p_id;
    delete from public.reward_catalog where id = p_id;
  else
    delete from public.milestone_partner_benefits where id = p_id;
  end if;
  -- Do not delete shared image files or renumber the remaining offers.
end;
$$;

revoke all on function public.delete_inactive_milestone_offer(text, bigint, boolean) from public, anon, authenticated, service_role;
grant execute on function public.delete_inactive_milestone_offer(text, bigint, boolean) to authenticated;

commit;
