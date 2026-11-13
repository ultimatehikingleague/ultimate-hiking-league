-- Review draft. Apply only after explicit production approval.
begin;

create function public.import_reviewed_uhl_events_2027(
  candidates jsonb,
  reviewed_fingerprint text
)
returns table(candidate_id text, event_id bigint, outcome text, new_distances integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  candidate record;
  existing public.events_master%rowtype;
  existing_distances numeric[];
  actual_fingerprint text;
begin
  if auth.uid() is null or not exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  ) then
    raise exception 'UHL administrator required' using errcode = '42501';
  end if;
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'The import requires READ COMMITTED';
  end if;
  if reviewed_fingerprint is null or reviewed_fingerprint !~ '^[0-9a-f]{32}$'
     or jsonb_typeof(candidates) is distinct from 'array' then
    raise exception 'Invalid reviewed import payload';
  end if;
  if jsonb_array_length(candidates) not between 1 and 80 then
    raise exception 'Invalid import batch size';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(candidates) as c(
      candidate_id text, slug text, title text, city text, country text,
      country_code text, event_date date, brand text, official_url text,
      booking_url text, distances numeric[]
    )
    where c.candidate_id is null or c.candidate_id !~ '^B[0-9]{3}$'
       or c.slug is null or c.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
       or nullif(btrim(c.title), '') is null or nullif(btrim(c.city), '') is null
       or nullif(btrim(c.country), '') is null or nullif(btrim(c.brand), '') is null
       or c.country_code is null or c.country_code !~ '^[A-Z]{2}$'
       or c.event_date is null or c.event_date not between date '2027-01-01' and date '2027-12-31'
       or c.official_url is null or c.official_url !~ '^https?://[^/[:space:]]+'
       or (c.booking_url is not null and c.booking_url !~ '^https?://[^/[:space:]]+')
       or coalesce(cardinality(c.distances), 0) = 0
       or exists (select 1 from unnest(c.distances) km
                  where km is null or km <= 0 or km::text in ('NaN', 'Infinity', '-Infinity'))
       or c.distances is distinct from array(select distinct km from unnest(c.distances) km order by km)
  ) or exists (
    select 1 from jsonb_array_elements(candidates) c
    group by c->>'slug' having count(*) > 1
  ) or exists (
    select 1 from jsonb_array_elements(candidates) c
    group by c->>'candidate_id' having count(*) > 1
  ) then
    raise exception 'Invalid or duplicate event, field or distance in import batch';
  end if;

  -- Existing role grants permit the lock. NOWAIT prevents queuing behind a writer.
  lock table public.events_master, public.event_distances in share row exclusive mode nowait;

  select md5(coalesce(jsonb_agg(jsonb_build_array(
    e.id, e.slug, e.title, e.city, e.country, e.country_code, e.event_date,
    e.brand, e.official_url, e.status,
    (select coalesce(jsonb_agg(trim_scale(d.distance_km) order by d.distance_km), '[]'::jsonb)
     from public.event_distances d where d.event_id = e.id)
  ) order by e.id)::text, '[]')) into actual_fingerprint
  from public.events_master e
  where e.event_date >= date '2027-01-01' and e.event_date < date '2028-01-01'
    and not exists (select 1 from jsonb_array_elements(candidates) c where c->>'slug' = e.slug);

  if actual_fingerprint is distinct from reviewed_fingerprint then
    raise exception '2027 calendar changed since review. Rerun the complete read-only check';
  end if;

  for candidate in
    select * from jsonb_to_recordset(candidates) as c(
      candidate_id text, slug text, title text, city text, country text,
      country_code text, event_date date, brand text, official_url text,
      booking_url text, description text, distances numeric[]
    ) order by c.candidate_id
  loop
    candidate_id := candidate.candidate_id;
    select e.* into existing from public.events_master e where e.slug = candidate.slug;
    if found then
      select array_agg(d.distance_km order by d.distance_km) into existing_distances
      from public.event_distances d where d.event_id = existing.id;
      if row(existing.title, existing.city, existing.country, existing.country_code,
             existing.event_date, existing.brand, existing.official_url,
             existing.booking_url, existing.description, existing_distances)
         is distinct from
         row(candidate.title, candidate.city, candidate.country, candidate.country_code,
             candidate.event_date, candidate.brand, candidate.official_url,
             candidate.booking_url, candidate.description, candidate.distances) then
        raise exception 'Slug occupied by a different or incomplete event (%)', candidate_id;
      end if;
      event_id := existing.id;
      outcome := 'already_present';
      new_distances := 0;
    else
      if exists (
        select 1 from public.events_master e
        where e.event_date = candidate.event_date
          and upper(e.country_code) = candidate.country_code
          and lower(btrim(e.title)) = lower(candidate.title)
          and (lower(btrim(e.city)) = lower(candidate.city)
               or lower(btrim(e.brand)) = lower(candidate.brand))
      ) then
        raise exception 'Possible content duplicate (%)', candidate_id;
      end if;

      insert into public.events_master as e
        (slug, title, city, country, country_code, event_date, brand,
         official_url, booking_url, description)
      values (candidate.slug, candidate.title, candidate.city, candidate.country,
              candidate.country_code, candidate.event_date, candidate.brand,
              candidate.official_url, candidate.booking_url, candidate.description)
      returning e.id into event_id;
      insert into public.event_distances (event_id, distance_km, label)
      select event_id, km, trim_scale(km)::text || ' km'
      from unnest(candidate.distances) km;
      get diagnostics new_distances = row_count;
      outcome := 'created';
    end if;
    return next;
  end loop;
end;
$$;

revoke all on function public.import_reviewed_uhl_events_2027(jsonb, text)
  from public, anon, authenticated, service_role;
grant execute on function public.import_reviewed_uhl_events_2027(jsonb, text)
  to authenticated;
commit;
