begin;

create table public.partner_placement_approvals (
  booking_id uuid primary key references public.partner_bookings(id) on delete restrict,
  start_on date not null,
  end_on date,
  approved_by uuid not null,
  approved_at timestamptz not null default now(),
  event_ids bigint[] not null default '{}',
  revoked_by uuid,
  revoked_at timestamptz,
  revoke_reason text,
  check (end_on is null or end_on >= start_on)
);

create table public.partner_social_mentions (
  booking_id uuid primary key references public.partner_bookings(id) on delete restrict,
  published_on date not null,
  post_url text not null,
  recorded_by uuid not null,
  recorded_at timestamptz not null default now()
);

alter table public.partner_placement_approvals enable row level security;
alter table public.partner_social_mentions enable row level security;
revoke all on public.partner_placement_approvals, public.partner_social_mentions from public, anon, authenticated, service_role;
grant select on public.partner_placement_approvals to service_role;
grant select, insert on public.partner_social_mentions to service_role;

create function public.uhl_partner_https(value text) returns boolean
language sql immutable set search_path = public as $$
  select coalesce(value ~ '^https://[A-Za-z0-9][^[:space:]]+$', false)
$$;

create function public.uhl_partner_eligible(p_booking_id uuid)
returns table(start_on date, end_on date)
language sql stable security definer set search_path = public as $$
  select (d.terms->>'start')::date, (d.terms->>'end')::date
  from public.partner_dossiers d
  where d.booking_id = p_booking_id and d.accepted_on is not null and d.paid_on is not null
    and d.payment_requested_at is not null and d.paid_cents > 0
    and d.paid_cents = (d.terms->>'amountCents')::integer
  union all
  select c.agreed_start, c.effective_end
  from public.partner_cooperations c
  where c.booking_id = p_booking_id and (c.kind in ('goodwill', 'unpaid_milestone') or c.fulfilled_on is not null)
$$;

revoke all on function public.uhl_partner_eligible(uuid) from public, anon, authenticated, service_role;

create function public.uhl_approve_partner_placement(p_booking_id uuid, p_admin uuid, p_event_ids bigint[])
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

  if b.booking_type = 'brand_partner' and b.package_code in ('A','B','C','D','E','F') then
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

create table public.partner_placement_history (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.partner_bookings(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  snapshot jsonb not null
);
alter table public.partner_placement_history enable row level security;
revoke all on public.partner_placement_history from public, anon, authenticated, service_role;
grant select on public.partner_placement_history to service_role;

create function public.uhl_record_placement_history() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.partner_placement_history(booking_id, snapshot) values(new.booking_id, to_jsonb(new));
  return new;
end
$$;
create trigger uhl_placement_history after insert or update on public.partner_placement_approvals
for each row execute function public.uhl_record_placement_history();

create function public.uhl_revoke_partner_placement(p_booking_id uuid, p_admin uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if nullif(btrim(p_reason), '') is null then raise exception 'Bitte einen Grund für die Abschaltung angeben.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('uhl-partner-placements', 0));
  update public.partner_placement_approvals set revoked_by=p_admin, revoked_at=now(), revoke_reason=p_reason
  where booking_id=p_booking_id and revoked_at is null;
  if not found then raise exception 'Keine bestehende Freigabe gefunden.'; end if;
end
$$;

create function public.uhl_protect_approved_placement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new is distinct from old and exists (
    select 1 from public.partner_placement_approvals a where a.booking_id = old.id and a.revoked_at is null
  ) then
    raise exception 'Bitte zuerst die Werbefreigabe mit Begründung zurückziehen.';
  end if;
  return new;
end
$$;

create trigger uhl_protect_approved_placement before update on public.partner_bookings
for each row execute function public.uhl_protect_approved_placement();

create function public.uhl_partner_ads(p_surface text)
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
      when 'events' then b.booking_type = 'event_partner' and nullif(event.slug, '') is not null
      else false end
  order by a.approved_at, b.id, array_position(a.event_ids, event.id::bigint)
$$;

revoke all on function public.uhl_approve_partner_placement(uuid,uuid,bigint[]),
  public.uhl_revoke_partner_placement(uuid,uuid,text), public.uhl_partner_ads(text)
from public, anon, authenticated;
grant execute on function public.uhl_approve_partner_placement(uuid,uuid,bigint[]),
  public.uhl_revoke_partner_placement(uuid,uuid,text) to service_role;
grant execute on function public.uhl_partner_ads(text) to anon, authenticated;

commit;
