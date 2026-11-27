begin;

create schema uhl_reviews_private;
revoke all on schema uhl_reviews_private from public, anon, authenticated;

create table uhl_reviews_private.organizers (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(btrim(name)) between 1 and 200)
);

create table uhl_reviews_private.series (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  locality text not null check (char_length(btrim(locality)) between 1 and 200)
);

create table uhl_reviews_private.editions (
  event_id bigint primary key references public.events_master(id),
  series_id bigint not null references uhl_reviews_private.series(id),
  organizer_id bigint not null references uhl_reviews_private.organizers(id)
);

create table uhl_reviews_private.self_submitted_records (
  record_id bigint primary key references public.records(id) on delete cascade,
  submission_id bigint not null unique references public.record_submissions(id) on delete cascade
);

create table uhl_reviews_private.reviews (
  id bigint generated always as identity primary key,
  account_id uuid references auth.users(id),
  hiker_id bigint references public.hikers(id),
  record_id bigint references public.records(id),
  event_id bigint references uhl_reviews_private.editions(event_id),
  distance_id bigint references public.event_distances(id),
  series_id bigint not null references uhl_reviews_private.series(id),
  organizer_id bigint not null references uhl_reviews_private.organizers(id),
  participation_year int check (participation_year between 1900 and 9999),
  stars smallint[] not null check (
    cardinality(stars) = 7 and array_ndims(stars) = 1 and array_lower(stars, 1) = 1
    and array_position(stars, null) is null and 1 <= all(stars) and 5 >= all(stars)
  ),
  comments text[] not null check (
    cardinality(comments) = 7 and array_ndims(comments) = 1 and array_lower(comments, 1) = 1
    and coalesce(char_length(comments[1]),0) <= 500 and coalesce(char_length(comments[2]),0) <= 500
    and coalesce(char_length(comments[3]),0) <= 500 and coalesce(char_length(comments[4]),0) <= 500
    and coalesce(char_length(comments[5]),0) <= 500 and coalesce(char_length(comments[6]),0) <= 500
    and coalesce(char_length(comments[7]),0) <= 500
  ),
  show_name boolean not null default false,
  draft_stars smallint[],
  draft_comments text[],
  draft_show_name boolean,
  revision bigint not null default 1,
  author_withdrew boolean not null default false,
  verified_at timestamptz not null default now(),
  invalidated_at timestamptz,
  status text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  unique (hiker_id, series_id, participation_year),
  unique (account_id, series_id, participation_year)
);

create index uhl_review_record_idx on uhl_reviews_private.reviews(record_id);
create index uhl_review_approved_series_idx on uhl_reviews_private.reviews(series_id, id desc) where status = 'approved';
create index uhl_review_approved_organizer_idx on uhl_reviews_private.reviews(organizer_id, id desc) where status = 'approved';

create table uhl_reviews_private.moderation (
  id bigint generated always as identity primary key,
  review_id bigint not null references uhl_reviews_private.reviews(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  status text not null,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);

alter table uhl_reviews_private.organizers enable row level security;
alter table uhl_reviews_private.series enable row level security;
alter table uhl_reviews_private.editions enable row level security;
alter table uhl_reviews_private.self_submitted_records enable row level security;
alter table uhl_reviews_private.reviews enable row level security;
alter table uhl_reviews_private.moderation enable row level security;

create function uhl_reviews_private.assert_admin() returns void
language plpgsql stable set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.admin_users where user_id = auth.uid()
  ) then
    raise exception 'review_forbidden' using errcode = '42501';
  end if;
end
$$;

-- Match only records written by the approval flow. Imported results, claims,
-- and profile merges never create provenance.
create function uhl_reviews_private.submission_candidates(p_submission bigint default null)
returns table(submission_id bigint,record_id bigint)
language sql stable set search_path='' as $$
  select s.id,r.id
  from public.record_submissions s
  join public.records r on r.hiker_id=s.hiker_id
    and r.verified is true and r.record_status='verified_admin_submission'
    and (s.event_master_id is null or s.event_master_id=r.event_master_id)
    and (s.event_distance_id is null or s.event_distance_id=r.event_distance_id)
    and r.activity_date=s.activity_date and r.distance_km=s.distance_km
    and nullif(btrim(r.time_text),'') is not distinct from nullif(btrim(s.elapsed_time_text),'')
    and (r.elevation_gain is not distinct from s.elevation_gain or exists (
      select 1 from public.record_corrections c
      where c.record_id=r.id and c.user_id=s.user_id and c.status='approved'
        and c.created_at>=s.reviewed_at and c.reviewed_at>=c.created_at
        and c.elevation_gain is not distinct from r.elevation_gain
    ))
    and r.created_at between s.reviewed_at-interval '10 minutes' and s.reviewed_at+interval '10 minutes'
    and r.created_at>=s.created_at
  join public.event_distances d on d.id=r.event_distance_id and d.event_id=r.event_master_id
    and d.distance_km=s.official_distance_km
  where s.status='approved' and s.submission_type='official_event'
    and s.user_id is not null and s.reviewed_at>=s.created_at
    and coalesce(r.record_source,'') not in ('official_results','manual_import','import')
    and (p_submission is null or s.id=p_submission)
$$;

-- Existing approvals do not carry a record ID. Use mutually unique pairs only.
with candidates as (
  select c.*,count(*) over(partition by c.record_id) as record_matches,
    count(*) over(partition by c.submission_id) as submission_matches
  from uhl_reviews_private.submission_candidates() c
)
insert into uhl_reviews_private.self_submitted_records(record_id,submission_id)
select c.record_id,c.submission_id
from candidates c
join public.record_submissions s on s.id=c.submission_id
join public.records r on r.id=c.record_id
join public.hikers h on h.id=r.hiker_id and h.claimed_by_user_id=s.user_id
join auth.users u on u.id=s.user_id
where c.record_matches=1 and c.submission_matches=1;

-- Only an authenticated administrator's real approval transition records
-- provenance in the future. A client-created approved row does not qualify.
alter table public.record_submissions add column uhl_review_draft jsonb;

create function uhl_reviews_private.valid_review_draft(p jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
begin
  if jsonb_typeof(p) is distinct from 'object'
    or jsonb_typeof(p->'stars') is distinct from 'array'
    or jsonb_typeof(p->'comments') is distinct from 'array'
    or jsonb_typeof(p->'named') is distinct from 'boolean' then return false; end if;
  return jsonb_array_length(p->'stars')=7 and jsonb_array_length(p->'comments')=7
    and not exists(select 1 from jsonb_array_elements(p->'stars') x where jsonb_typeof(x)<>'number' or x::text !~ '^[1-5]$')
    and not exists(select 1 from jsonb_array_elements(p->'comments') x
      where jsonb_typeof(x) not in ('null','string') or char_length(x #>> '{}')>500);
end
$$;

create function uhl_reviews_private.check_submission_draft()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' and new.uhl_review_draft is not null and old.uhl_review_draft is distinct from new.uhl_review_draft then
    raise exception 'review_draft_immutable';
  end if;
  if new.uhl_review_draft is not null and
    (new.submission_type is distinct from 'official_event' or not uhl_reviews_private.valid_review_draft(new.uhl_review_draft)
      or (tg_op='INSERT' and new.status is distinct from 'pending')) then
    raise exception 'review_invalid_content' using errcode='23514';
  end if;
  return new;
end
$$;

create trigger uhl_validate_submission_review before insert or update of uhl_review_draft on public.record_submissions
for each row execute function uhl_reviews_private.check_submission_draft();

create function uhl_reviews_private.stage_submission_reviews(p_event bigint)
returns void language sql set search_path='' as $$
  with staged as (insert into uhl_reviews_private.reviews
    (account_id,hiker_id,record_id,event_id,distance_id,series_id,organizer_id,participation_year,stars,comments,show_name)
  select s.user_id,r.hiker_id,r.id,m.id,d.id,e.series_id,e.organizer_id,
    extract(year from coalesce(r.activity_date,m.event_date))::int,
    array(select x::smallint from jsonb_array_elements_text(s.uhl_review_draft->'stars') x),
    array(select nullif(btrim(x),'') from jsonb_array_elements_text(s.uhl_review_draft->'comments') x),
    (s.uhl_review_draft->>'named')::boolean
  from uhl_reviews_private.self_submitted_records p
  join public.record_submissions s on s.id=p.submission_id and s.status='approved'
  join auth.users u on u.id=s.user_id
  join public.records r on r.id=p.record_id and r.verified is true
  join public.hikers h on h.id=r.hiker_id and h.claimed_by_user_id=s.user_id
  join public.events_master m on m.id=r.event_master_id
  join uhl_reviews_private.editions e on e.event_id=m.id
  join public.event_distances d on d.id=r.event_distance_id and d.event_id=m.id
  where m.id=p_event and s.uhl_review_draft is not null and m.event_date<=(now() at time zone 'Europe/Berlin')::date
    and coalesce(r.activity_date,m.event_date)<=(now() at time zone 'Europe/Berlin')::date
  order by s.id
  on conflict do nothing returning record_id)
  update public.record_submissions s set uhl_review_draft=null
  from uhl_reviews_private.self_submitted_records p join staged r on r.record_id=p.record_id
  where s.id=p.submission_id
$$;

create function uhl_reviews_private.stage_assigned_reviews()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform uhl_reviews_private.stage_submission_reviews(new.event_id);
  return new;
end
$$;

create trigger uhl_stage_assigned_reviews after insert on uhl_reviews_private.editions
for each row execute function uhl_reviews_private.stage_assigned_reviews();

create function uhl_reviews_private.capture_self_submission()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.admin_users where user_id=auth.uid()) then return new; end if;
  insert into uhl_reviews_private.self_submitted_records(record_id,submission_id)
  select min(c.record_id),new.id
  from uhl_reviews_private.submission_candidates(new.id) c
  join public.records r on r.id=c.record_id
  join public.hikers h on h.id=r.hiker_id and h.claimed_by_user_id=new.user_id
  join auth.users u on u.id=new.user_id
  having count(*)=1
  on conflict do nothing;
  if new.uhl_review_draft is not null then
    perform uhl_reviews_private.stage_submission_reviews(r.event_master_id)
    from uhl_reviews_private.self_submitted_records p join public.records r on r.id=p.record_id
    where p.submission_id=new.id;
  end if;
  return new;
end
$$;

create trigger uhl_reviews_capture_self_submission after update of status on public.record_submissions
for each row when (old.status is distinct from new.status and new.status='approved')
execute function uhl_reviews_private.capture_self_submission();

create function uhl_reviews_private.owns_self_submission(p_record bigint,p_account uuid)
returns boolean language sql stable set search_path='' as $$
  select exists (
    select 1 from uhl_reviews_private.self_submitted_records p
    join public.record_submissions s on s.id=p.submission_id and s.status='approved'
      and s.submission_type='official_event'
    join auth.users u on u.id=s.user_id
    join public.records r on r.id=p.record_id and r.verified is true
    join public.hikers h on h.id=r.hiker_id and h.claimed_by_user_id=s.user_id
    where p.record_id=p_record and s.user_id=p_account
  )
$$;

create function uhl_reviews_private.proofs(p_event bigint)
returns table(record_id bigint, hiker_id bigint, distance_id bigint, participation_year int)
language sql stable set search_path = '' as $$
  select r.id,r.hiker_id,d.id,extract(year from coalesce(r.activity_date,m.event_date))::int
  from public.records r
  join public.events_master m on m.id=r.event_master_id
  join uhl_reviews_private.editions e on e.event_id=m.id
  join public.event_distances d on d.id=r.event_distance_id and d.event_id=m.id
  where m.id=p_event and uhl_reviews_private.owns_self_submission(r.id,auth.uid())
    and m.event_date <= (now() at time zone 'Europe/Berlin')::date
    and coalesce(r.activity_date,m.event_date) <= (now() at time zone 'Europe/Berlin')::date
  order by d.distance_km,r.id
$$;

create function public.uhl_review_options(p_event bigint)
returns table(record_id bigint, distance_km numeric, existing_status text)
language sql security definer set search_path = '' as $$
  select distinct on (p.distance_id) p.record_id, d.distance_km, coalesce(r.status,'')
  from uhl_reviews_private.proofs(p_event) p
  join public.event_distances d on d.id = p.distance_id
  join uhl_reviews_private.editions e on e.event_id = p_event
  left join uhl_reviews_private.reviews r on r.series_id = e.series_id
    and r.participation_year = p.participation_year
    and (r.hiker_id = p.hiker_id or r.account_id = auth.uid())
  order by p.distance_id, p.record_id
$$;

create function public.uhl_submit_review(
  p_event bigint, p_record bigint, p_stars smallint[], p_comments text[], p_show_name boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare
  proof record;
  edition uhl_reviews_private.editions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'review_forbidden' using errcode = '42501';
  end if;
  perform 1 from auth.users where id = auth.uid() for key share;
  if not found then raise exception 'review_forbidden' using errcode = '42501'; end if;
  perform 1 from public.hikers where claimed_by_user_id = auth.uid() for share;
  perform 1 from public.records r join public.hikers h on h.id=r.hiker_id
    where r.id=p_record and h.claimed_by_user_id=auth.uid() for update of r;
  select * into edition from uhl_reviews_private.editions where event_id = p_event for share;
  select * into proof from uhl_reviews_private.proofs(p_event) where record_id = p_record;
  if not found then raise exception 'review_ineligible' using errcode = '42501'; end if;

  if exists(select 1 from unnest(p_comments) c where char_length(c) > 500) then
    raise exception 'review_comment_too_long' using errcode = '22001';
  end if;
  insert into uhl_reviews_private.reviews
    (account_id,hiker_id,record_id,event_id,distance_id,series_id,organizer_id,participation_year,stars,comments,show_name)
  values (auth.uid(),proof.hiker_id,p_record,p_event,proof.distance_id,edition.series_id,edition.organizer_id,
    proof.participation_year,
    array(select x from unnest(p_stars) x),
    array(select nullif(btrim(x),'') from unnest(p_comments) x),
    coalesce(p_show_name,false));
exception
  when unique_violation then raise exception 'review_duplicate' using errcode = '23505';
end
$$;

-- Changes to measurements and other technical metadata leave the evidence intact.
create function uhl_reviews_private.invalidate_record() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update uhl_reviews_private.reviews
  set invalidated_at = coalesce(invalidated_at,now()),
      record_id = case when tg_op = 'DELETE' then null else record_id end
  where record_id = old.id;
  return old;
end
$$;

create trigger uhl_reviews_invalidate_unverified
after update of verified on public.records
for each row when (old.verified is true and new.verified is not true)
execute function uhl_reviews_private.invalidate_record();

create trigger uhl_reviews_invalidate_deleted
before delete on public.records
for each row execute function uhl_reviews_private.invalidate_record();

-- Keep approved verified content as an independent, anonymous historical review.
-- Remove other content associated with the account or profile being deleted.
create function uhl_reviews_private.detach_author() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  target_hiker bigint;
  target_account uuid;
begin
  if tg_table_schema = 'auth' then
    target_account := old.id;
    update public.record_submissions set uhl_review_draft=null
    where user_id=target_account and uhl_review_draft is not null;
  else
    target_hiker := old.id;
    -- A record already transferred to another profile of the same account is
    -- a profile correction. Keep its proof and its moderation state.
    update uhl_reviews_private.reviews rv
    set hiker_id=h.id
    from public.records r join public.hikers h on h.id=r.hiker_id
    where rv.hiker_id=target_hiker and rv.record_id=r.id and r.verified is true
      and h.id<>target_hiker and h.claimed_by_user_id=rv.account_id;
  end if;

  delete from uhl_reviews_private.reviews
  where (hiker_id = target_hiker or account_id = target_account)
    and (status <> 'approved' or invalidated_at is not null
      or not uhl_reviews_private.owns_self_submission(record_id,account_id));

  update uhl_reviews_private.reviews
  set account_id=null, hiker_id=null, record_id=null, event_id=null,
      distance_id=null, participation_year=null, show_name=false,
      draft_stars=null, draft_comments=null, draft_show_name=null
  where hiker_id = target_hiker or account_id = target_account;
  return old;
end
$$;

create trigger uhl_reviews_detach_account before delete on auth.users
for each row execute function uhl_reviews_private.detach_author();

create trigger uhl_reviews_detach_hiker before delete on public.hikers
for each row execute function uhl_reviews_private.detach_author();

create view uhl_reviews_private.published as
select r.id,r.series_id,r.organizer_id,r.stars,r.comments,r.approved_at,
       case when r.show_name then nullif(btrim(h.display_name),'') end as author_name
from uhl_reviews_private.reviews r
left join public.hikers h on h.id = r.hiker_id and h.claimed_by_user_id = r.account_id
where r.status='approved' and r.invalidated_at is null
  and (r.account_id is null or uhl_reviews_private.owns_self_submission(r.record_id,r.account_id));

create view uhl_reviews_private.summaries as
select 'series'::text as kind,s.id as target_id,s.slug,s.name,
       sum(p.stars[1]+p.stars[2]+p.stars[3]+p.stars[4]+p.stars[5]+p.stars[6])::numeric / (6 * count(*)) as score,
       count(*) as review_count
from uhl_reviews_private.published p join uhl_reviews_private.series s on s.id=p.series_id
group by s.id
union all
select 'organizer',o.id,o.slug,o.name,avg(p.stars[7]::numeric),count(*)
from uhl_reviews_private.published p join uhl_reviews_private.organizers o on o.id=p.organizer_id
group by o.id;

create function public.uhl_event_review_summaries(p_events bigint[])
returns table(event_id bigint, score numeric, review_count bigint, organizer_slug text, organizer_name text, category_scores numeric[])
language sql stable security definer set search_path = '' as $$
  select e.event_id,s.score,coalesce(s.review_count,0),o.slug,o.name,
    array(select (select avg(p.stars[i]::numeric) from uhl_reviews_private.published p where p.series_id=e.series_id)
      from generate_series(1,6) i order by i)
  from uhl_reviews_private.editions e
  join uhl_reviews_private.organizers o on o.id=e.organizer_id
  left join uhl_reviews_private.summaries s on s.kind='series' and s.target_id=e.series_id
  where e.event_id=any(p_events)
$$;

create function public.uhl_review_rankings(p_kind text, p_offset int default 0)
returns table(rank_number bigint, slug text, name text, score numeric, review_count bigint, event_slug text)
language sql stable security definer set search_path = '' as $$
  select dense_rank() over(order by s.score desc,s.review_count desc),s.slug,s.name,s.score,s.review_count,
    case when s.kind='series' then (
      select m.slug from uhl_reviews_private.editions e join public.events_master m on m.id=e.event_id
      where e.series_id=s.target_id order by m.event_date desc nulls last,m.id desc limit 1
    ) end
  from uhl_reviews_private.summaries s where s.kind=p_kind and s.review_count>=5
  order by s.score desc,s.review_count desc,s.name,s.slug
  limit 50 offset greatest(p_offset,0)
$$;

create function public.uhl_public_reviews(p_event bigint, p_organizer text, p_before bigint default null)
returns table(id bigint, stars smallint[], comments text[], author_name text)
language sql stable security definer set search_path = '' as $$
  select r.id,
         case when p_organizer is null then r.stars[1:6] else r.stars[7:7] end,
         case when p_organizer is null then r.comments[1:6] else r.comments[7:7] end,
         r.author_name
  from uhl_reviews_private.published r
  where (p_before is null or r.id < p_before) and
    ((p_organizer is null and r.series_id=(select series_id from uhl_reviews_private.editions where event_id=p_event))
    or (p_organizer is not null and r.organizer_id=(select id from uhl_reviews_private.organizers where slug=p_organizer)))
  order by r.id desc limit 20
$$;

create function public.uhl_organizer_review_summary(p_slug text)
returns table(name text, score numeric, review_count bigint)
language sql stable security definer set search_path = '' as $$
  select o.name,s.score,coalesce(s.review_count,0)
  from uhl_reviews_private.organizers o left join uhl_reviews_private.summaries s
    on s.kind='organizer' and s.target_id=o.id where o.slug=p_slug
$$;

create function public.uhl_moderation_queue(p_status text, p_before bigint default null)
returns table(id bigint, event_name text, organizer_name text, author_name text, stars smallint[],
              comments text[], status text, invalidated boolean, has_proof boolean, created_at timestamptz, revision bigint, is_revision boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform uhl_reviews_private.assert_admin();
  return query select r.id,coalesce(m.title,s.name),o.name,h.display_name,
    case when p_status='pending' then coalesce(r.draft_stars,r.stars) else r.stars end,
    case when p_status='pending' then coalesce(r.draft_comments,r.comments) else r.comments end,
    p_status,r.invalidated_at is not null,r.record_id is not null,r.created_at,r.revision,
    p_status='pending' and r.draft_stars is not null
  from uhl_reviews_private.reviews r
  join uhl_reviews_private.organizers o on o.id=r.organizer_id
  join uhl_reviews_private.series s on s.id=r.series_id
  left join public.events_master m on m.id=r.event_id
  left join public.hikers h on h.id=r.hiker_id
  where (r.status=p_status or (p_status='pending' and r.status='approved' and r.draft_stars is not null))
    and (p_before is null or r.id<p_before)
  order by r.id desc limit 30;
end
$$;

create function public.uhl_moderate_review(p_review bigint,p_status text,p_note text,p_revision bigint default null)
returns void language plpgsql security definer set search_path = '' as $$
declare item uhl_reviews_private.reviews%rowtype;
begin
  perform uhl_reviews_private.assert_admin();
  select * into item from uhl_reviews_private.reviews where id=p_review for update;
  if not found or item.author_withdrew or p_status is null
     or (p_revision is not null and p_revision<>item.revision) or not (
    (item.status='pending' and p_status in ('approved','rejected'))
    or (item.status='approved' and item.draft_stars is not null
        and p_revision=item.revision and p_status in ('approved','rejected'))
    or (item.status='approved' and p_status='withdrawn')
    or (item.status in ('withdrawn','rejected') and p_status='pending' and item.record_id is not null)
  ) then raise exception 'review_invalid_transition'; end if;
  if p_status='approved' and (item.invalidated_at is not null or not uhl_reviews_private.owns_self_submission(item.record_id,item.account_id)) then raise exception 'review_ineligible'; end if;
  update uhl_reviews_private.reviews set
    status=case when p_status='rejected' and item.status='approved' then 'approved' else p_status end,
    stars=case when p_status='approved' then coalesce(item.draft_stars,item.stars) else item.stars end,
    comments=case when p_status='approved' then coalesce(item.draft_comments,item.comments) else item.comments end,
    show_name=case when p_status='approved' then coalesce(item.draft_show_name,item.show_name) else item.show_name end,
    draft_stars=null,draft_comments=null,draft_show_name=null,revision=revision+1,
    approved_at=case when p_status='approved' then now() else approved_at end where id=p_review;
  insert into uhl_reviews_private.moderation(review_id,actor_id,status,note)
  values (p_review,auth.uid(),p_status,nullif(btrim(p_note),''));
end
$$;

create function public.uhl_my_review(p_event bigint)
returns table(id bigint, stars smallint[], comments text[], show_name boolean, status text, pending_revision boolean, editable boolean)
language sql stable security definer set search_path = '' as $$
  select r.id,coalesce(r.draft_stars,r.stars),coalesce(r.draft_comments,r.comments),
    coalesce(r.draft_show_name,r.show_name),r.status,r.draft_stars is not null,
    not r.author_withdrew and r.invalidated_at is null and uhl_reviews_private.owns_self_submission(r.record_id,r.account_id)
  from uhl_reviews_private.reviews r
  join auth.users u on u.id=r.account_id
  where r.account_id=auth.uid() and (
    r.event_id=p_event or exists (
      select 1 from uhl_reviews_private.proofs(p_event) p
      join uhl_reviews_private.editions e on e.event_id=p_event
      where r.series_id=e.series_id and r.participation_year=p.participation_year
    )
  )
  order by (r.event_id=p_event) desc,r.id desc limit 1
$$;

create function public.uhl_activity_review_context(p_record bigint)
returns table(event_id bigint,eligible boolean)
language sql stable security definer set search_path='' as $$
  select r.event_master_id,exists(select 1 from uhl_reviews_private.proofs(r.event_master_id) p where p.record_id=r.id)
  from public.records r join public.hikers h on h.id=r.hiker_id and h.claimed_by_user_id=auth.uid()
  where r.id=p_record and r.event_master_id is not null
$$;
revoke all on function public.uhl_activity_review_context(bigint) from public,anon,authenticated;
grant execute on function public.uhl_activity_review_context(bigint) to authenticated;

create function public.uhl_revise_review(p_review bigint,p_stars smallint[],p_comments text[],p_show_name boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare item uhl_reviews_private.reviews%rowtype; new_stars smallint[]; new_comments text[];
begin
  select * into item from uhl_reviews_private.reviews where id=p_review and account_id=auth.uid() for update;
  if not found or item.author_withdrew or item.invalidated_at is not null
    or not uhl_reviews_private.owns_self_submission(item.record_id,item.account_id) then raise exception 'review_ineligible' using errcode='42501'; end if;
  new_stars := array(select x from unnest(p_stars) x);
  new_comments := array(select nullif(btrim(x),'') from unnest(p_comments) x);
  if cardinality(new_stars)<>7 or array_position(new_stars,null) is not null or
     not (1<=all(new_stars) and 5>=all(new_stars)) or cardinality(new_comments)<>7 or
     exists(select 1 from unnest(p_comments) c where char_length(c)>500)
  then raise exception 'review_invalid_content' using errcode='23514'; end if;
  if item.status='approved' then
    update uhl_reviews_private.reviews set draft_stars=new_stars,draft_comments=new_comments,
      draft_show_name=coalesce(p_show_name,false),revision=revision+1 where id=p_review;
  else
    update uhl_reviews_private.reviews set stars=new_stars,
      comments=new_comments,show_name=coalesce(p_show_name,false),
      status='pending',revision=revision+1 where id=p_review;
  end if;
end
$$;

create function public.uhl_manage_own_review(p_review bigint,p_action text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_action='hide_name' then
    update uhl_reviews_private.reviews set show_name=false,
      draft_show_name=case when draft_stars is not null then false end,revision=revision+1
    where id=p_review and account_id=auth.uid();
  elsif p_action='withdraw' then
    update uhl_reviews_private.reviews set status='withdrawn',author_withdrew=true,
      show_name=false,draft_stars=null,draft_comments=null,draft_show_name=null,revision=revision+1
    where id=p_review and account_id=auth.uid();
  else raise exception 'review_invalid_action'; end if;
  if not found then raise exception 'review_forbidden' using errcode='42501'; end if;
end
$$;

revoke all on function public.uhl_my_review(bigint),public.uhl_revise_review(bigint,smallint[],text[],boolean),
  public.uhl_manage_own_review(bigint,text) from public,anon,authenticated;
grant execute on function public.uhl_my_review(bigint),public.uhl_revise_review(bigint,smallint[],text[],boolean),
  public.uhl_manage_own_review(bigint,text) to authenticated;

create function public.uhl_assign_review_edition(
  p_event bigint, p_series_slug text,p_series_name text,p_organizer_slug text,p_organizer_name text
) returns void language plpgsql security definer set search_path = '' as $$
declare locality text; series_key bigint; organizer_key bigint; current_edition record;
begin
  perform uhl_reviews_private.assert_admin();
  select city into locality from public.events_master where id=p_event for update;
  if not found then raise exception 'review_event_missing'; end if;
  select * into current_edition from uhl_reviews_private.editions where event_id=p_event for update;
  insert into uhl_reviews_private.series(slug,name,locality)
    values(p_series_slug,btrim(p_series_name),locality) on conflict(slug) do nothing;
  select id into series_key from uhl_reviews_private.series where slug=p_series_slug;
  insert into uhl_reviews_private.organizers(slug,name)
    values(p_organizer_slug,btrim(p_organizer_name)) on conflict(slug) do nothing;
  select id into organizer_key from uhl_reviews_private.organizers where slug=p_organizer_slug;
  if (current_edition.series_id,current_edition.organizer_id) is distinct from (series_key,organizer_key)
      and exists(select 1 from uhl_reviews_private.reviews where event_id=p_event) then
    raise exception 'review_assignment_in_use';
  end if;
  insert into uhl_reviews_private.editions(event_id,series_id,organizer_id)
  values(p_event,series_key,organizer_key) on conflict(event_id) do update
    set series_id=excluded.series_id,organizer_id=excluded.organizer_id;
end
$$;

-- Remove personal information from a specific comment without changing its score.
create function public.uhl_redact_review_comment(p_review bigint,p_category int,p_note text,p_draft boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform uhl_reviews_private.assert_admin();
  if p_category is null or p_category not between 1 and 7 then
    raise exception 'review_invalid_category';
  end if;
  if p_draft is true then
    update uhl_reviews_private.reviews set draft_comments[p_category]=null,revision=revision+1
    where id=p_review and draft_comments[p_category] is not null;
  else
    update uhl_reviews_private.reviews set comments[p_category]=null,revision=revision+1
    where id=p_review and comments[p_category] is not null;
  end if;
  if not found then raise exception 'review_comment_missing'; end if;
  insert into uhl_reviews_private.moderation(review_id,actor_id,status,note)
  values (p_review,auth.uid(),'comment_redacted',nullif(btrim(p_note),''));
end
$$;

create function public.uhl_rename_review_target(p_kind text,p_slug text,p_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform uhl_reviews_private.assert_admin();
  if p_kind='organizer' then
    update uhl_reviews_private.organizers set name=btrim(p_name) where slug=p_slug;
  elsif p_kind='series' then
    update uhl_reviews_private.series set name=btrim(p_name) where slug=p_slug;
  else raise exception 'review_target_missing';
  end if;
  if not found then raise exception 'review_target_missing'; end if;
end
$$;

revoke all on all tables in schema uhl_reviews_private from public,anon,authenticated;
revoke all on all functions in schema uhl_reviews_private from public,anon,authenticated;
revoke all on function public.uhl_review_options(bigint), public.uhl_submit_review(bigint,bigint,smallint[],text[],boolean),
  public.uhl_event_review_summaries(bigint[]), public.uhl_review_rankings(text,int),
  public.uhl_public_reviews(bigint,text,bigint), public.uhl_organizer_review_summary(text),
  public.uhl_moderation_queue(text,bigint), public.uhl_moderate_review(bigint,text,text,bigint),
  public.uhl_assign_review_edition(bigint,text,text,text,text), public.uhl_rename_review_target(text,text,text), public.uhl_redact_review_comment(bigint,int,text,boolean)
  from public,anon,authenticated;
grant execute on function public.uhl_event_review_summaries(bigint[]), public.uhl_review_rankings(text,int),
  public.uhl_public_reviews(bigint,text,bigint), public.uhl_organizer_review_summary(text) to anon,authenticated;
grant execute on function public.uhl_review_options(bigint), public.uhl_submit_review(bigint,bigint,smallint[],text[],boolean),
  public.uhl_moderation_queue(text,bigint), public.uhl_moderate_review(bigint,text,text,bigint),
  public.uhl_assign_review_edition(bigint,text,text,text,text), public.uhl_rename_review_target(text,text,text), public.uhl_redact_review_comment(bigint,int,text,boolean) to authenticated;

-- Verified calendar candidates only. Remaining assignments are administered separately.
-- Organizer source: https://www.megamarsch.de/teilnahmebedingungen
with candidates(event_id,edition_date,series_slug,series_name,locality) as (values
  (29,date '2026-02-21','megamarsch-mallorca','Megamarsch Mallorca','Mallorca'),
  (42,date '2026-05-16','megamarsch-muenchen','Megamarsch München','München'),
  (50,date '2026-11-07','megamarsch-nuernberg','Megamarsch Nürnberg','Nürnberg'),
  (581,date '2027-05-15','megamarsch-muenchen','Megamarsch München','München')
), matched as (
  select c.* from candidates c join public.events_master m on m.id=c.event_id
  where m.event_date=c.edition_date and m.city=c.locality and m.brand='Megamarsch'
    and m.title in (c.series_name,c.series_name || ' ' || extract(year from c.edition_date)::text)
), organizer as (
  insert into uhl_reviews_private.organizers(slug,name)
  select 'hundert24','Megamarsch · hundert24 GmbH' where exists(select 1 from matched)
  returning id
), series as (
  insert into uhl_reviews_private.series(slug,name,locality)
  select distinct series_slug,series_name,locality from matched
  returning id,slug
)
insert into uhl_reviews_private.editions(event_id,series_id,organizer_id)
select m.event_id,s.id,o.id from matched m join series s on s.slug=m.series_slug cross join organizer o;

commit;
