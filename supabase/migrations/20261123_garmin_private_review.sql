create table public.garmin_private_reviews (
  owner_id uuid not null references public.garmin_connections(user_id) on delete cascade,
  activity_id text not null,
  evidence jsonb not null default '{}',
  conflicting_feeds text[] not null default '{}',
  status text not null default 'unresolved' check (status in ('unresolved', 'rejected', 'consistent')),
  reason text not null default 'missing-feed-pair',
  distance_km numeric,
  ascent_m numeric,
  elapsed_hhmm text,
  primary key (owner_id, activity_id)
);

alter table public.garmin_private_reviews enable row level security;
revoke all on public.garmin_private_reviews from public, anon, authenticated, service_role;
grant select on public.garmin_private_reviews to service_role;

-- Runs for accepted inbox rows, before the worker can attempt a FIT download.
-- A separate row keeps private evidence outside the FIT import and publication snapshots.
create function public.capture_garmin_private_review()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  activity text := new.payload->>'activityId';
  incoming jsonb := new.payload->'privateEvidence';
  review public.garmin_private_reviews;
  summary jsonb;
  details jsonb;
  file_push jsonb;
  distance numeric;
  ascent numeric;
  seconds numeric;
  minutes bigint;
  hours_text text;
  start_seconds numeric;
  origins jsonb[];
  origin_field text;
  outcome text := 'unresolved';
  why text;
begin
  if activity is null or activity = '' or jsonb_typeof(incoming) is distinct from 'object' then
    return new;
  end if;

  -- enqueue_garmin_push checks Garmin user ID and pilot ownership and locks the grant.
  perform 1 from public.garmin_connections c where c.user_id = new.owner_id
    and c.activity_export_revoked_at is null and c.deregistered_at is null for share;
  if not found then return new; end if;

  insert into public.garmin_private_reviews(owner_id, activity_id) values (new.owner_id, activity)
    on conflict (owner_id, activity_id) do nothing;
  select * into strict review from public.garmin_private_reviews
    where owner_id = new.owner_id and activity_id = activity for update;

  if not (review.evidence ? new.feed) then
    review.evidence := review.evidence || jsonb_build_object(new.feed, incoming);
  elsif review.evidence->new.feed is distinct from incoming and not (new.feed = any(review.conflicting_feeds)) then
    review.conflicting_feeds := array_append(review.conflicting_feeds, new.feed);
  else
    return new;
  end if;

  summary := review.evidence->'activities';
  details := review.evidence->'activityDetails';
  file_push := review.evidence->'activityFiles';
  distance := (summary->>'distanceKm')::numeric;
  ascent := (summary->>'ascent')::numeric;
  seconds := (details->>'elapsedSeconds')::numeric;
  start_seconds := (summary->>'startTimeInSeconds')::numeric;

  case
    when cardinality(review.conflicting_feeds) > 0 then why := 'redelivery-conflict';
    when summary is null or details is null then why := 'missing-feed-pair';
    when summary @> '{"identityConflict":true}' or details @> '{"identityConflict":true}'
      or file_push @> '{"identityConflict":true}' then why := 'activity-identity-conflict';
    when start_seconds is null or details->>'startTimeInSeconds' is null then why := 'start-time-missing';
    when summary->'startTimeInSeconds' <> details->'startTimeInSeconds'
      or (file_push->>'startTimeInSeconds' is not null and file_push->'startTimeInSeconds' <> summary->'startTimeInSeconds')
      then why := 'start-time-conflict';
    when start_seconds <= 0 or start_seconds + coalesce(seconds, 0) > extract(epoch from new.received_at) + 1
      then outcome := 'rejected'; why := 'invalid-activity-time';
    when summary->>'type' is null or details->>'type' is null then why := 'activity-type-missing';
    when summary->'type' <> details->'type' or (file_push->>'type' is not null and file_push->'type' <> summary->'type')
      then why := 'activity-type-conflict';
    when summary->>'type' <> 'HIKING' then outcome := 'rejected'; why := 'not-hiking';
    when distance is null or ascent is null or details->>'distanceKm' is null or details->>'ascent' is null
      then why := 'measurements-missing';
    when summary->'distanceKm' <> details->'distanceKm' or summary->'ascent' <> details->'ascent'
      then why := 'measurement-conflict';
    when distance <= 0 then outcome := 'rejected'; why := 'invalid-distance';
    when seconds is not null and (seconds < 60 or seconds / 60 > 2147483647)
      then outcome := 'rejected'; why := 'invalid-elapsed-time';
    when distance * 3600 > 15 * seconds then outcome := 'rejected'; why := 'average-speed-over-15-kmh';
    when ascent * 3600 > 2000 * seconds then outcome := 'rejected'; why := 'implausible-ascent-rate';
    when details->>'sampleCheck' in ('sample-time-inconsistent', 'sample-coordinates-invalid', 'sample-gps-jump')
      then outcome := 'rejected'; why := details->>'sampleCheck';
    when summary->>'device' is null or details->>'device' is null then why := 'device-missing';
    when summary->'device' <> details->'device' or (file_push->>'device' is not null and file_push->'device' <> summary->'device')
      then why := 'device-conflict';
    else
      foreach origin_field in array array['manual', 'isWebUpload'] loop
        origins := array[summary->origin_field, details->origin_field, file_push->origin_field];
        if '"invalid"'::jsonb = any(origins) then why := origin_field || '-invalid';
        elsif '"conflict"'::jsonb = any(origins) or ('true'::jsonb = any(origins) and 'false'::jsonb = any(origins))
          then why := origin_field || '-conflict';
        elsif 'true'::jsonb = any(origins) then outcome := 'rejected'; why := origin_field || '-true';
        elsif not coalesce('false'::jsonb = any(origins), false) then why := origin_field || '-missing';
        end if;
        exit when why is not null;
      end loop;
      if why is null then
        if details->>'sampleCheck' is distinct from 'samples-consistent' then
          why := coalesce(details->>'sampleCheck', 'samples-missing');
        elsif seconds is null then why := 'elapsed-time-missing';
        else outcome := 'consistent'; why := 'feed-checks-passed';
        end if;
      end if;
  end case;

  minutes := trunc(seconds / 60);
  hours_text := (minutes / 60)::text;

  update public.garmin_private_reviews set
    evidence = review.evidence, conflicting_feeds = review.conflicting_feeds, status = outcome, reason = why,
    distance_km = case when summary->'distanceKm' = details->'distanceKm' then round(distance, 2) end,
    ascent_m = case when summary->'ascent' = details->'ascent' then round(ascent) end,
    elapsed_hhmm = case when minutes is not null then
      lpad(hours_text, greatest(2, length(hours_text)), '0') || ':' || lpad((minutes % 60)::text, 2, '0') end
  where owner_id = new.owner_id and activity_id = activity;
  return new;
end;
$$;

create trigger garmin_private_review_on_push after insert on public.garmin_push_inbox
for each row execute function public.capture_garmin_private_review();

create function public.clear_garmin_private_reviews()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.garmin_private_reviews where owner_id = new.user_id;
  return new;
end;
$$;

create trigger garmin_private_reviews_on_grant_change after update on public.garmin_connections
for each row when (
  old.garmin_user_id is distinct from new.garmin_user_id or
  old.connected_at is distinct from new.connected_at or
  (old.activity_export_revoked_at is null and new.activity_export_revoked_at is not null) or
  (old.deregistered_at is null and new.deregistered_at is not null)
) execute function public.clear_garmin_private_reviews();

revoke all on function public.capture_garmin_private_review(), public.clear_garmin_private_reviews()
from public, anon, authenticated, service_role;
