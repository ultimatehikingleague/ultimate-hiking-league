begin;

create function public.uhl_latest_event_reviews()
returns table(id bigint, event_slug text, event_name text, country_code text, organizer_name text, score numeric)
language sql stable security definer set search_path = '' as $$
  select p.id, m.slug, m.title::text, m.country_code::text, o.name,
         (p.stars[1]+p.stars[2]+p.stars[3]+p.stars[4]+p.stars[5]+p.stars[6])::numeric / 6
  from uhl_reviews_private.published p
  join uhl_reviews_private.reviews r on r.id=p.id
  join uhl_reviews_private.organizers o on o.id=p.organizer_id
  join public.events_master m on m.id=coalesce(r.event_id, (
    select e.event_id
    from uhl_reviews_private.editions e
    join public.events_master candidate on candidate.id=e.event_id
    where e.series_id=p.series_id and nullif(candidate.slug,'') is not null
    order by (e.organizer_id=p.organizer_id) desc, candidate.event_date desc nulls last, e.event_id desc
    limit 1
  ))
  where nullif(m.slug,'') is not null
    and nullif(btrim(m.title),'') is not null
  order by p.approved_at desc nulls last,p.id desc
  limit 3
$$;

revoke all on function public.uhl_latest_event_reviews() from public;
grant execute on function public.uhl_latest_event_reviews() to anon, authenticated;

commit;
