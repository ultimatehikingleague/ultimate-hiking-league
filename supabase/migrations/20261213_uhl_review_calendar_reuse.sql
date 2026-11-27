begin;

create function uhl_reviews_private.catalog_key(p_text text)
returns text language sql immutable set search_path='' as $$
  select btrim(regexp_replace(lower(coalesce(p_text,'')),'[[:space:]–—-]+',' ','g'))
$$;

create function uhl_reviews_private.catalog_title(p_text text,p_date date)
returns text language sql immutable set search_path='' as $$
  select uhl_reviews_private.catalog_key(regexp_replace(coalesce(p_text,''),
    '\m' || extract(year from p_date)::int || '\M','','g'))
$$;

create function uhl_reviews_private.catalog_host(p_url text)
returns text language sql immutable set search_path='' as $$
  select regexp_replace(lower(coalesce(substring(p_url from '^https?://([^/:?#]+)'),'')),'^www\.','')
$$;

create function uhl_reviews_private.reuse_edition_assignment()
returns trigger language plpgsql security definer set search_path='' as $$
declare match record;
begin
  if new.event_date is null or new.city is null or new.country_code is null or new.brand is null
    or uhl_reviews_private.catalog_host(new.official_url)='' then return new; end if;
  select min(a.series_id) series_id,min(a.organizer_id) organizer_id,
      count(distinct (a.series_id,a.organizer_id)) matches into match
  from uhl_reviews_private.editions a join public.events_master prior on prior.id=a.event_id
  where upper(prior.country_code)=upper(new.country_code)
    and uhl_reviews_private.catalog_key(prior.city)=uhl_reviews_private.catalog_key(new.city)
    and uhl_reviews_private.catalog_title(prior.title,prior.event_date)=uhl_reviews_private.catalog_title(new.title,new.event_date)
    and uhl_reviews_private.catalog_key(prior.brand)=uhl_reviews_private.catalog_key(new.brand)
    and uhl_reviews_private.catalog_host(prior.official_url)=uhl_reviews_private.catalog_host(new.official_url);
  if match.matches=1 then
    -- Serialize reuse within this series so two concurrent imports cannot create an
    -- unreviewed same-year association. Explicit admin associations stay possible.
    perform 1 from uhl_reviews_private.series where id=match.series_id for update;
    if not exists (
      select 1 from uhl_reviews_private.editions e join public.events_master m on m.id=e.event_id
      where e.series_id=match.series_id and extract(year from m.event_date)=extract(year from new.event_date)
    ) then
      insert into uhl_reviews_private.editions(event_id,series_id,organizer_id)
      values(new.id,match.series_id,match.organizer_id) on conflict do nothing;
    end if;
  end if;
  return new;
end
$$;

create trigger uhl_reviews_reuse_calendar_assignment
after insert on public.events_master
for each row execute function uhl_reviews_private.reuse_edition_assignment();

create function public.uhl_assign_review_editions_batch(p_rows jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare item record; applied integer:=0;
begin
  perform uhl_reviews_private.assert_admin();
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 1000 then
    raise exception 'review_invalid_batch';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_rows) as i(event_id bigint,series_slug text,organizer_slug text)
    group by i.event_id having count(*)>1
  ) then raise exception 'review_duplicate_edition'; end if;
  for item in
    select i.*,s.name series_name,o.name organizer_name
    from jsonb_to_recordset(p_rows) as i(event_id bigint,series_slug text,organizer_slug text)
    left join uhl_reviews_private.series s on s.slug=i.series_slug
    left join uhl_reviews_private.organizers o on o.slug=i.organizer_slug
    order by i.event_id
  loop
    if item.series_name is null or item.organizer_name is null then raise exception 'review_target_missing'; end if;
    perform public.uhl_assign_review_edition(item.event_id,item.series_slug,item.series_name,item.organizer_slug,item.organizer_name);
    applied:=applied+1;
  end loop;
  return applied;
end
$$;

revoke all on function uhl_reviews_private.catalog_key(text),uhl_reviews_private.catalog_title(text,date),uhl_reviews_private.catalog_host(text),
  uhl_reviews_private.reuse_edition_assignment() from public,anon,authenticated;
revoke all on function public.uhl_assign_review_editions_batch(jsonb) from public,anon,authenticated;
grant execute on function public.uhl_assign_review_editions_batch(jsonb) to authenticated;
commit;
