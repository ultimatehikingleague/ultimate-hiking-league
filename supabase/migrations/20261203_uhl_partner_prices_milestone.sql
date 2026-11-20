begin;

-- Approved advertising is exposed through uhl_partner_ads, which returns public
-- placement fields. Retire the legacy table reads before adding private prices.
drop policy if exists "Public can read partners used for active bookings" on public.partners;
drop policy if exists "Public can read active partner bookings" on public.partner_bookings;

alter table public.partner_dossiers
  add column cancellation_at timestamptz,
  add column cancellation_by uuid,
  add column cancellation_reason text,
  add constraint partner_dossier_cancellation_complete check (
    (cancellation_at is null and cancellation_by is null and cancellation_reason is null)
    or (cancellation_at is not null and cancellation_by is not null
      and cancellation_reason is not null and length(btrim(cancellation_reason)) between 1 and 500
      and accepted_on is not null and payment_requested_at is not null
      and payment_due_on is not null and paid_on is null
      and payment_due_on < (cancellation_at at time zone 'Europe/Berlin')::date)
  );

grant update (cancellation_at, cancellation_by, cancellation_reason)
  on public.partner_dossiers to service_role;

create function public.uhl_protect_partner_dossier_archive() returns trigger
language plpgsql set search_path = '' as $$
begin
  if row(old.booking_id, old.terms, old.offer_pdf, old.offered_at, old.offered_by)
    is distinct from row(new.booking_id, new.terms, new.offer_pdf, new.offered_at, new.offered_by)
    or (old.accepted_on is not null and row(old.accepted_on, old.contract_pdf, old.accepted_by)
      is distinct from row(new.accepted_on, new.contract_pdf, new.accepted_by))
    or (old.payment_requested_at is not null and row(old.payment_requested_at, old.payment_requested_by,
      old.payment_due_on, old.payment_request_pdf)
      is distinct from row(new.payment_requested_at, new.payment_requested_by, new.payment_due_on, new.payment_request_pdf))
    or (old.paid_on is not null and row(old.paid_on, old.paid_cents, old.payment_note,
      old.payment_confirmed_by, old.payment_confirmed_at)
      is distinct from row(new.paid_on, new.paid_cents, new.payment_note, new.payment_confirmed_by, new.payment_confirmed_at))
    or (old.invoice_number is not null and row(old.invoice_number, old.invoice_issued_at, old.invoice_issued_by, old.invoice_seller)
      is distinct from row(new.invoice_number, new.invoice_issued_at, new.invoice_issued_by, new.invoice_seller))
    or (old.invoice_pdf is not null and old.invoice_pdf is distinct from new.invoice_pdf)
    or (old.cancellation_at is not null and row(old.cancellation_at, old.cancellation_by, old.cancellation_reason)
      is distinct from row(new.cancellation_at, new.cancellation_by, new.cancellation_reason))
  then
    raise exception 'Archivierte Partnerunterlagen können nicht geändert werden.' using errcode = '23514';
  end if;
  return new;
end
$$;

revoke all on function public.uhl_protect_partner_dossier_archive() from public, anon, authenticated, service_role;
create trigger uhl_protect_partner_dossier_archive before update on public.partner_dossiers
for each row execute function public.uhl_protect_partner_dossier_archive();

alter table public.partner_bookings
  add column agreed_price_cents integer check (agreed_price_cents >= 0),
  add column list_price_cents integer check (list_price_cents >= 0),
  add constraint partner_bookings_milestone_terms check (
    package_code is distinct from 'M' or (
      booking_type = 'brand_partner' and agreed_price_cents is not distinct from 0
      and start_date is not null and end_date is not null and end_date >= start_date
    )
  );

-- Abort on contradictory archived workflows before copying any terms.
do $$
begin
  if exists (
    select 1 from public.partner_dossiers d
    join public.partner_cooperations c using (booking_id)
  ) then
    raise exception 'Partnerbuchung mit Angebot und Kooperation. Altbestand vor der Migration prüfen.';
  end if;
  if exists (
    select 1 from public.partner_dossiers d
    join public.partner_bookings b on b.id = d.booking_id
    where (d.terms->>'amountCents')::integer is null
      or (d.terms->>'amountCents')::integer <= 0
      or (d.terms->>'start')::date is distinct from b.start_date
      or (d.terms->>'end')::date is distinct from b.end_date
  ) or exists (
    select 1 from public.partner_cooperations c
    join public.partner_bookings b on b.id = c.booking_id
    where c.agreed_start is distinct from b.start_date
  ) then
    raise exception 'Archivierte Partnerkonditionen und Buchung weichen voneinander ab. Altbestand vor der Migration prüfen.';
  end if;
end
$$;

-- An archived offer supplies the historical amount. Unknown legacy amounts stay NULL.
-- Existing approval triggers also guard live bookings. Populate their new metadata
-- in the same transaction before adding the price immutability trigger.
alter table public.partner_bookings disable trigger uhl_protect_approved_placement;
update public.partner_bookings b
set agreed_price_cents = (d.terms->>'amountCents')::integer
from public.partner_dossiers d
where b.id = d.booking_id and d.terms ? 'amountCents';
update public.partner_bookings b
set agreed_price_cents = 0
from public.partner_cooperations c
where b.id = c.booking_id;
alter table public.partner_bookings enable trigger uhl_protect_approved_placement;

create function public.uhl_protect_partner_price_snapshot() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.list_price_cents is distinct from old.list_price_cents then
    raise exception 'Der Listenpreis der Buchung ist archiviert.';
  end if;
  if row(new.agreed_price_cents, new.start_date, new.end_date, new.duration_days, new.partner_id, new.booking_type, new.package_code, new.package_name)
      is distinct from row(old.agreed_price_cents, old.start_date, old.end_date, old.duration_days, old.partner_id, old.booking_type, old.package_code, old.package_name)
    and (exists (select 1 from public.partner_dossiers where booking_id = old.id)
      or exists (select 1 from public.partner_cooperations where booking_id = old.id)) then
    raise exception 'Preis und Buchungslaufzeit sind bereits in einem Angebot oder einer Kooperation dokumentiert.';
  end if;
  return new;
end
$$;

create trigger uhl_protect_partner_price_snapshot before update on public.partner_bookings
for each row execute function public.uhl_protect_partner_price_snapshot();


create or replace function public.uhl_check_partner_draft() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  booking public.partner_bookings;
begin
  select * into booking from public.partner_bookings where id = new.booking_id for update;
  if not found or booking.status <> 'draft' then
    raise exception 'Partner booking draft required' using errcode = '23514';
  end if;
  if booking.booking_type = 'brand_partner' and booking.package_code = 'M' then
    raise exception 'Milestone-Präsenz wird direkt freigegeben.' using errcode = '23514';
  end if;
  if tg_table_name = 'partner_dossiers' then
    if (new.terms->>'amountCents')::integer is null or (new.terms->>'amountCents')::integer <= 0
      or (new.terms->>'amountCents')::integer is distinct from booking.agreed_price_cents
      or (new.terms->>'listPriceCents')::integer is distinct from booking.list_price_cents
      or (new.terms->>'start')::date is distinct from booking.start_date
      or (new.terms->>'end')::date is distinct from booking.end_date then
      raise exception 'Preis oder Laufzeit der Buchung wurde geändert. Bitte erneut laden.' using errcode = '23514';
    end if;
    if exists (select 1 from public.partner_cooperations where booking_id = new.booking_id) then
      raise exception 'Cooperation already exists' using errcode = '23505';
    end if;
  elsif exists (select 1 from public.partner_dossiers where booking_id = new.booking_id) then
    raise exception 'Offer already exists' using errcode = '23505';
  elsif booking.agreed_price_cents is distinct from 0 or new.agreed_start is distinct from booking.start_date then
    raise exception 'Kooperation erfordert 0,00 EUR und den aktuellen Buchungsstart.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.uhl_partner_eligible(p_booking_id uuid)
returns table(start_on date, end_on date)
language sql stable security definer set search_path = public as $$
  select (d.terms->>'start')::date, (d.terms->>'end')::date
  from public.partner_dossiers d
  where d.booking_id = p_booking_id and d.cancellation_at is null and d.accepted_on is not null and d.paid_on is not null
    and d.payment_requested_at is not null and d.paid_cents > 0
    and d.paid_cents = (d.terms->>'amountCents')::integer
  union all
  select c.agreed_start, c.effective_end
  from public.partner_cooperations c
  where c.booking_id = p_booking_id and (c.kind in ('goodwill', 'unpaid_milestone') or c.fulfilled_on is not null)
  union all
  select b.start_date, b.end_date
  from public.partner_bookings b
  where b.id = p_booking_id and b.booking_type = 'brand_partner' and b.package_code = 'M'
    and b.agreed_price_cents = 0
$$;

create or replace function public.uhl_approve_partner_placement(p_booking_id uuid, p_admin uuid, p_event_ids bigint[])
returns void language plpgsql security definer set search_path = public as $$
declare
  b public.partner_bookings;
  effective_start date;
  effective_end date;
  approved_start date;
  event_limit integer;
  slot_limit integer;
  contract_year_start date;
  contract_years integer;
begin
  -- Serialize conflicting reservations, including reservations scheduled in the future.
  perform pg_advisory_xact_lock(hashtextextended('uhl-partner-placements', 0));
  select * into b from public.partner_bookings where id = p_booking_id for update;
  if not found or b.status not in ('draft', 'paused') then
    raise exception 'Buchungsentwurf oder pausierte Buchung erforderlich.';
  end if;
  if exists (select 1 from public.partner_placement_approvals a where a.booking_id = b.id and a.revoked_at is null) then
    raise exception 'Diese Buchung ist bereits freigegeben.';
  end if;

  select e.start_on, e.end_on into effective_start, effective_end from public.uhl_partner_eligible(b.id) e;
  if not found then
    raise exception 'Angenommener Vertrag und vollständige Zahlung oder dokumentierte Kooperation erforderlich.';
  end if;
  approved_start := greatest(effective_start, (now() at time zone 'Europe/Berlin')::date);
  if effective_end < approved_start then raise exception 'Der vereinbarte Zeitraum ist abgelaufen.'; end if;

  if b.booking_type = 'brand_partner' and b.package_code = 'M' then
    if coalesce(cardinality(p_event_ids), -1) <> 0 or effective_end is null
      or not public.uhl_partner_https(b.logo_url) or not public.uhl_partner_https(b.target_url) then
      raise exception 'Milestone-Präsenz benötigt Logo, HTTPS-Ziel-Link und ein festes Ende ohne Eventzuordnung.';
    end if;
    if exists (
      select from public.partner_placement_approvals a
      join public.partner_bookings other on other.id = a.booking_id
      where a.revoked_at is null and other.id <> b.id and other.status = 'draft'
        and other.booking_type = 'brand_partner' and other.package_code = 'M'
        and other.partner_id = b.partner_id
        and a.start_on <= effective_end and a.end_on >= approved_start
    ) then
      raise exception 'Für diesen Partner ist bereits eine Milestone-Präsenz im gewählten Zeitraum freigegeben.';
    end if;
  elsif b.booking_type = 'brand_partner' and b.package_code in ('A','B','C','D','E','F') then
    if coalesce(cardinality(p_event_ids), -1) <> 0 then raise exception 'Markenpakete werden ohne Eventzuordnung freigegeben.'; end if;
    if not public.uhl_partner_https(b.banner_url) or not public.uhl_partner_https(b.target_url) then
      raise exception 'Banner und Ziel-URL als HTTPS-Adresse hinterlegen.';
    end if;
    if b.package_code = 'F' and not public.uhl_partner_https(b.logo_url) then
      raise exception 'Für Official Partner ist ein Footerlogo erforderlich.';
    end if;
    if b.package_code = 'E' then slot_limit := 3; end if;
  elsif b.booking_type = 'event_partner' and b.package_code in ('A','B','C','D') then
    event_limit := case b.package_code when 'C' then 5 when 'D' then 15 else 1 end;
    if coalesce(cardinality(p_event_ids), 0) not between 1 and event_limit or cardinality(p_event_ids) <>
      (select count(*) from public.events_master e where e.id = any(p_event_ids) and nullif(e.slug, '') is not null) then
      raise exception 'Bitte % unterschiedliche gültige Events oder weniger zuordnen.', event_limit;
    end if;
    if not public.uhl_partner_https(b.logo_url) or nullif(btrim(b.custom_text), '') is null then
      raise exception 'Für Eventpakete sind ein HTTPS-Logo und eine Wunschbeschreibung erforderlich.';
    end if;
    if b.package_code = 'D' then
      contract_years := extract(year from approved_start)::integer - extract(year from effective_start)::integer;
      contract_year_start := (effective_start + make_interval(years => contract_years))::date;
      if contract_year_start > approved_start then
        contract_year_start := (effective_start + make_interval(years => contract_years - 1))::date;
      end if;
      if (
        select count(distinct entries.event_id)
        from (
          select unnest(p_event_ids)::text as event_id
          union all
          select jsonb_array_elements_text(prior.snapshot->'event_ids')
          from (
            select distinct on (h.snapshot->>'approved_at') h.snapshot
            from public.partner_placement_history h where h.booking_id = b.id
            order by h.snapshot->>'approved_at', h.id desc
          ) prior
          where (prior.snapshot->>'start_on')::date < contract_year_start + interval '1 year'
          and coalesce(((prior.snapshot->>'revoked_at')::timestamptz at time zone 'Europe/Berlin')::date, 'infinity'::date)
            >= contract_year_start
        ) entries
      ) > 15 then
        raise exception 'Im Vertragsjahr dürfen höchstens 15 unterschiedliche Events beworben werden.';
      end if;
      slot_limit := 1;
    end if;
  else
    raise exception 'Unbekanntes Werbepaket.';
  end if;

  if slot_limit is not null and exists (
    with reservations as (
      select a.start_on, coalesce(e.end_on, 'infinity'::date) as end_on
      from public.partner_placement_approvals a
      join public.partner_bookings other on other.id = a.booking_id
      cross join lateral public.uhl_partner_eligible(other.id) e
      where a.revoked_at is null and other.id <> b.id
        and other.booking_type = b.booking_type and other.package_code = b.package_code
        and other.status = 'draft'
        and a.start_on <= coalesce(effective_end, 'infinity'::date)
        and coalesce(e.end_on, 'infinity'::date) >= approved_start
    ), checkpoints as (
      select approved_start as day
      union
      select start_on from reservations where start_on >= approved_start
    )
    select from checkpoints c where (
      select count(*) from reservations r where c.day between r.start_on and r.end_on
    ) >= slot_limit
  ) then
    raise exception 'Für diesen Zeitraum sind alle Plätze des Pakets belegt.';
  end if;

  update public.partner_bookings set status = 'draft' where id = b.id;
  insert into public.partner_placement_approvals(booking_id, start_on, end_on, approved_by, event_ids)
  values(b.id, approved_start, effective_end, p_admin, p_event_ids)
  on conflict(booking_id) do update set start_on = excluded.start_on, end_on = excluded.end_on,
    approved_at = now(), approved_by = excluded.approved_by, event_ids = excluded.event_ids,
    revoked_at = null, revoked_by = null, revoke_reason = null;
end
$$;

create or replace function public.uhl_partner_ads(p_surface text)
returns table (
  booking_id uuid, booking_type text, package_code text, partner_name text,
  banner_url text, logo_url text, target_url text, custom_text text,
  event_id bigint, event_slug text, event_title text
)
language sql stable security definer set search_path = public as $$
  select b.id, b.booking_type::text, b.package_code::text, p.name::text,
    b.banner_url::text, b.logo_url::text, b.target_url::text, b.custom_text::text,
    event.id::bigint, event.slug::text, coalesce(nullif(event.title, ''), event.city)::text
  from public.partner_placement_approvals a
  join public.partner_bookings b on b.id=a.booking_id
  join public.partners p on p.id=b.partner_id
  cross join lateral public.uhl_partner_eligible(b.id) e
  left join lateral unnest(a.event_ids) as ids(event_id) on true
  left join public.events_master event on event.id=ids.event_id
  cross join lateral (select (now() at time zone 'Europe/Berlin')::date as today) t
  where a.revoked_at is null and b.status = 'draft'
    and t.today >= greatest(e.start_on, a.start_on)
    and (e.end_on is null or t.today <= e.end_on)
    and case p_surface
      when 'home' then (b.booking_type = 'brand_partner' and b.package_code in ('A','E','F'))
        or (b.booking_type = 'event_partner' and b.package_code in ('B','C','D')
          and nullif(event.slug, '') is not null)
      when 'rankings' then b.booking_type = 'brand_partner' and b.package_code = 'B'
      when 'profile' then b.booking_type = 'brand_partner' and b.package_code = 'C'
      when 'account' then b.booking_type = 'brand_partner' and b.package_code = 'D' and auth.uid() is not null
      when 'footer' then b.booking_type = 'brand_partner' and b.package_code = 'F'
      when 'milestone' then b.booking_type = 'brand_partner' and b.package_code = 'M'
      when 'events' then b.booking_type = 'event_partner' and nullif(event.slug, '') is not null
      else false end
  order by a.approved_at, b.id, array_position(a.event_ids, event.id::bigint)
$$;

commit;
