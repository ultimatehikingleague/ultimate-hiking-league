begin;

-- A dossier is private even when its associated advertisement becomes public.
create table public.partner_dossiers (
  booking_id uuid primary key references public.partner_bookings(id) on delete restrict,
  terms jsonb not null,
  offer_pdf text not null,
  offered_at timestamptz not null default now(),
  offered_by uuid not null,
  accepted_on date,
  contract_pdf text,
  accepted_by uuid,
  payment_requested_at timestamptz,
  payment_requested_by uuid,
  payment_due_on date,
  payment_request_pdf text,
  paid_on date,
  paid_cents integer,
  payment_note text,
  payment_confirmed_by uuid,
  payment_confirmed_at timestamptz,
  invoice_number text unique,
  invoice_issued_at timestamptz,
  invoice_issued_by uuid,
  invoice_seller jsonb,
  invoice_pdf text,
  invoice_archived boolean generated always as (invoice_pdf is not null) stored
);

alter table public.partner_dossiers enable row level security;
revoke all on public.partner_dossiers from public, anon, authenticated, service_role;
grant select, insert on public.partner_dossiers to service_role;
grant update (accepted_on, contract_pdf, accepted_by, payment_requested_at, payment_requested_by,
  payment_due_on, payment_request_pdf, paid_on, paid_cents, payment_note, payment_confirmed_by,
  payment_confirmed_at, invoice_pdf) on public.partner_dossiers to service_role;

create table public.partner_cooperations (
  booking_id uuid primary key references public.partner_bookings(id) on delete restrict,
  kind text not null check (kind in ('in_kind', 'goodwill', 'unpaid_milestone')),
  explanation text not null check (length(btrim(explanation)) > 0),
  term_kind text not null check (term_kind in ('fixed', 'partnership', 'minimum')),
  agreed_start date not null,
  fixed_end date,
  partnership_end date,
  minimum_end date,
  closed_by uuid,
  closed_at timestamptz,
  effective_end date generated always as (case when fixed_end is not null then fixed_end when partnership_end is not null then greatest(partnership_end, minimum_end) end) stored,
  recorded_by uuid not null,
  recorded_at timestamptz not null default now(),
  fulfilled_on date,
  fulfillment_note text,
  fulfilled_by uuid,
  check (
    (term_kind = 'fixed' and fixed_end is not null and partnership_end is null and minimum_end is null)
    or (term_kind = 'partnership' and fixed_end is null and minimum_end is null)
    or (term_kind = 'minimum' and fixed_end is null and minimum_end is not null)
  ),
  check (fixed_end >= agreed_start and partnership_end >= agreed_start and minimum_end >= agreed_start),
  check (kind = 'in_kind' or fulfilled_on is null)
);

alter table public.partner_cooperations enable row level security;
revoke all on public.partner_cooperations from public, anon, authenticated, service_role;
grant select, insert on public.partner_cooperations to service_role;
grant update (partnership_end, closed_by, closed_at, fulfilled_on, fulfillment_note, fulfilled_by) on public.partner_cooperations to service_role;

-- Serialize the choice of cash workflow or cooperation for each draft.
create function public.uhl_check_partner_draft() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  booking public.partner_bookings;
begin
  select * into booking from public.partner_bookings where id = new.booking_id for update;
  if not found or booking.status <> 'draft' then
    raise exception 'Partner booking draft required' using errcode = '23514';
  end if;
  if tg_table_name = 'partner_dossiers' then
    if exists (select 1 from public.partner_cooperations where booking_id = new.booking_id) then
      raise exception 'Cooperation already exists' using errcode = '23505';
    end if;
  elsif exists (select 1 from public.partner_dossiers where booking_id = new.booking_id) then
    raise exception 'Offer already exists' using errcode = '23505';
  end if;
  return new;
end;
$$;

create trigger uhl_partner_dossier_draft before insert on public.partner_dossiers
for each row execute function public.uhl_check_partner_draft();
create trigger uhl_partner_cooperation_draft before insert on public.partner_cooperations
for each row execute function public.uhl_check_partner_draft();

create function public.uhl_issue_partner_invoice(p_booking_id uuid, p_admin uuid, p_seller jsonb)
returns table(number text, issued_at timestamptz)
language plpgsql security definer set search_path = public
as $$
declare
  dossier public.partner_dossiers;
begin
  select * into dossier from public.partner_dossiers where booking_id = p_booking_id for update;
  if not found or dossier.accepted_on is null or dossier.payment_requested_at is null
      or dossier.paid_on is null or dossier.paid_cents is distinct from (dossier.terms->>'amountCents')::integer
      or dossier.paid_cents <= 0 then
    raise exception 'Confirmed payment in full required';
  end if;

  if dossier.invoice_number is null then
    if coalesce(p_seller->>'taxNumber', '') = '' then
      raise exception 'Seller tax number required';
    end if;
    update public.partner_dossiers
      set invoice_number = public.uhl_next_invoice_number('live'), invoice_issued_at = now(),
          invoice_issued_by = p_admin, invoice_seller = p_seller
      where booking_id = p_booking_id
      returning * into dossier;
  end if;
  return query select dossier.invoice_number, dossier.invoice_issued_at;
end;
$$;

revoke all on function public.uhl_issue_partner_invoice(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.uhl_issue_partner_invoice(uuid, uuid, jsonb) to service_role;

-- Hold new advertising until the placement review and the full activation gate are implemented.
create function public.uhl_hold_partner_activation() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'active' then
    if tg_op = 'INSERT' then
      raise exception 'Advertising placement approval is pending';
    end if;
    if old.status is distinct from new.status then
      raise exception 'Advertising placement approval is pending';
    end if;
  end if;
  return new;
end;
$$;

create trigger uhl_hold_partner_activation before insert or update of status on public.partner_bookings
for each row execute function public.uhl_hold_partner_activation();

commit;
