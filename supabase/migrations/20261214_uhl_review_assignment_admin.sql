begin;

create function public.uhl_review_assignment_overview() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  perform uhl_reviews_private.assert_admin();
  select jsonb_build_object(
    'editions', coalesce((select jsonb_agg(to_jsonb(x) order by x.date desc nulls last,x.title,x.id) from (
      select e.id::text,coalesce(e.title,'Veranstaltung') title,e.event_date date,e.city,
        e.country_code country,e.brand,a.series_id::text,a.organizer_id::text,
        coalesce(r.total,0) review_count
      from public.events_master e
      left join uhl_reviews_private.editions a on a.event_id=e.id
      left join (select event_id,count(*) total from uhl_reviews_private.reviews
        where event_id is not null group by event_id) r on r.event_id=e.id
    ) x),'[]'),
    'series',coalesce((select jsonb_agg(jsonb_build_object('id',id::text,'name',name,'locality',locality)
      order by name,locality,id) from uhl_reviews_private.series),'[]'),
    'organizers',coalesce((select jsonb_agg(jsonb_build_object('id',id::text,'name',name)
      order by name,id) from uhl_reviews_private.organizers),'[]')
  ) into result;
  return result;
end
$$;

create function public.uhl_save_review_assignments(p_editions jsonb,p_series bigint,p_organizer bigint,
  p_new_series text,p_new_organizer text) returns integer
language plpgsql security definer set search_path='' as $$
declare item record; event_city text; first_city text; existing_series bigint;
  existing_organizer bigint; series_target record; organizer_target record; written integer:=0;
begin
  perform uhl_reviews_private.assert_admin();
  if jsonb_typeof(p_editions) is distinct from 'array' or jsonb_array_length(p_editions) not between 1 and 100 then
    raise exception 'review_invalid_batch';
  end if;
  if (p_series is not null and p_new_series is not null)
    or (p_organizer is not null and p_new_organizer is not null)
    or (p_new_series is not null and char_length(btrim(p_new_series)) not between 1 and 200)
    or (p_new_organizer is not null and char_length(btrim(p_new_organizer)) not between 1 and 200)
    or (p_series is null and p_organizer is null and p_new_series is null and p_new_organizer is null) then
    raise exception 'review_invalid_target';
  end if;
  if exists(select 1 from jsonb_to_recordset(p_editions) x(id bigint) group by id having count(*)>1) then
    raise exception 'review_duplicate_edition';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(20261214,1);
  for item in select * from jsonb_to_recordset(p_editions) x(id bigint,series_id bigint,organizer_id bigint) order by id loop
    select e.city into event_city from public.events_master e where e.id=item.id for update;
    if not found then raise exception 'review_event_missing'; end if;
    select series_id,organizer_id into existing_series,existing_organizer
      from uhl_reviews_private.editions where event_id=item.id for update;
    if (existing_series,existing_organizer) is distinct from (item.series_id,item.organizer_id) then
      raise exception 'review_assignment_changed';
    end if;
    if (p_new_series is not null or p_new_organizer is not null or
        (coalesce(p_series,existing_series),coalesce(p_organizer,existing_organizer))
        is distinct from (existing_series,existing_organizer))
      and exists(select 1 from uhl_reviews_private.reviews where event_id=item.id) then
      raise exception 'review_assignment_in_use';
    end if;
    if first_city is null then first_city:=nullif(btrim(event_city),''); end if;
  end loop;
  if p_new_series is not null then
    if exists(select 1 from uhl_reviews_private.series where uhl_reviews_private.catalog_key(name)=uhl_reviews_private.catalog_key(p_new_series)) then
      raise exception 'review_target_exists';
    end if;
    insert into uhl_reviews_private.series(slug,name,locality)
      values('reihe-'||replace(pg_catalog.gen_random_uuid()::text,'-',''),btrim(p_new_series),coalesce(first_city,'—'))
      returning id into p_series;
  end if;
  if p_new_organizer is not null then
    if exists(select 1 from uhl_reviews_private.organizers where uhl_reviews_private.catalog_key(name)=uhl_reviews_private.catalog_key(p_new_organizer)) then
      raise exception 'review_target_exists';
    end if;
    insert into uhl_reviews_private.organizers(slug,name)
      values('veranstalter-'||replace(pg_catalog.gen_random_uuid()::text,'-',''),btrim(p_new_organizer))
      returning id into p_organizer;
  end if;
  for item in select * from jsonb_to_recordset(p_editions) x(id bigint,series_id bigint,organizer_id bigint) order by id loop
    select slug,name into series_target from uhl_reviews_private.series where id=coalesce(p_series,item.series_id);
    select slug,name into organizer_target from uhl_reviews_private.organizers where id=coalesce(p_organizer,item.organizer_id);
    if series_target.slug is null or organizer_target.slug is null then raise exception 'review_target_missing'; end if;
    if (coalesce(p_series,item.series_id),coalesce(p_organizer,item.organizer_id)) is distinct from (item.series_id,item.organizer_id) then
      -- Targets already exist. The existing write path retains its review guard.
      perform public.uhl_assign_review_edition(item.id,series_target.slug,series_target.name,organizer_target.slug,organizer_target.name);
      written:=written+1;
    end if;
  end loop;
  return written;
end
$$;

create function public.uhl_rename_review_target_by_id(p_kind text,p_id bigint,p_name text) returns void
language plpgsql security definer set search_path='' as $$
declare target_slug text;
begin
  perform uhl_reviews_private.assert_admin();
  if p_name is null or char_length(btrim(p_name)) not between 1 and 200 then raise exception 'review_invalid_target'; end if;
  perform pg_catalog.pg_advisory_xact_lock(20261214,1);
  if p_kind='series' then
    select slug into target_slug from uhl_reviews_private.series where id=p_id;
    if exists(select 1 from uhl_reviews_private.series where id<>p_id and uhl_reviews_private.catalog_key(name)=uhl_reviews_private.catalog_key(p_name)) then
      raise exception 'review_target_exists';
    end if;
  elsif p_kind='organizer' then
    select slug into target_slug from uhl_reviews_private.organizers where id=p_id;
    if exists(select 1 from uhl_reviews_private.organizers where id<>p_id and uhl_reviews_private.catalog_key(name)=uhl_reviews_private.catalog_key(p_name)) then
      raise exception 'review_target_exists';
    end if;
  end if;
  if target_slug is null then raise exception 'review_target_missing'; end if;
  perform public.uhl_rename_review_target(p_kind,target_slug,p_name);
end
$$;

revoke all on function public.uhl_review_assignment_overview(),
  public.uhl_save_review_assignments(jsonb,bigint,bigint,text,text),
  public.uhl_rename_review_target_by_id(text,bigint,text) from public,anon,authenticated;
grant execute on function public.uhl_review_assignment_overview(),
  public.uhl_save_review_assignments(jsonb,bigint,bigint,text,text),
  public.uhl_rename_review_target_by_id(text,bigint,text) to authenticated;

commit;
