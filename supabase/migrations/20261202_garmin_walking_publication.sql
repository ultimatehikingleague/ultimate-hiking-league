begin;

-- Change only the type guards, preserving installed event and attribution logic.
do $$
declare
  review_function regprocedure := to_regprocedure(
    'public.evaluate_garmin_private_review(public.garmin_private_reviews,timestamptz)');
  change record;
  definition text;
  previous_guard text;
  capture_definition text;
  replay_guard constant text := $guard$else
    return new;
  end if;

  summary :=$guard$;
  replay_override constant text := $guard$elsif tg_table_name <> 'garmin_walking_review_recheck' then
    return new;
  end if;

  summary :=$guard$;
begin
  if review_function is null then
    review_function := 'public.capture_garmin_private_review()'::regprocedure;
  elsif strpos(pg_get_functiondef('public.capture_garmin_private_review()'::regprocedure),
      'public.evaluate_garmin_private_review(') = 0 then
    raise exception 'Garmin review evaluator is not used by the capture trigger';
  end if;

  for change in
    select * from (values
      (
        review_function,
        $guard$when summary->>'type' <> 'HIKING' then outcome := 'rejected'; why := 'not-hiking';$guard$,
        $guard$when summary->>'type' not in ('HIKING', 'WALKING', 'CASUAL_WALKING', 'SPEED_WALKING') then outcome := 'rejected'; why := 'not-hiking';$guard$,
        $guard$when summary->>'type' not in ('HIKING', 'WALKING') then outcome := 'rejected'; why := 'not-hiking';$guard$
      ),
      (
        'public.publish_garmin_activity(uuid,bigint,text,text,timestamptz,jsonb,jsonb)'::regprocedure,
        $guard$if activity.summary->>'type' is distinct from 'HIKING'$guard$,
        $guard$if activity.summary->>'type' is null
    or activity.summary->>'type' not in ('HIKING', 'WALKING', 'CASUAL_WALKING', 'SPEED_WALKING')$guard$,
        $guard$if (activity.summary->>'type' is null or activity.summary->>'type' not in ('HIKING', 'WALKING'))$guard$
      )
    ) as guards(function_id, hiking_only_guard, wider_guard, new_guard)
  loop
    definition := pg_get_functiondef(change.function_id);
    if strpos(definition, change.new_guard) > 0
      and strpos(definition, change.hiking_only_guard) = 0
      and strpos(definition, change.wider_guard) = 0 then
      continue;
    end if;
    previous_guard := case when strpos(definition, change.hiking_only_guard) > 0
      then change.hiking_only_guard else change.wider_guard end;
    if length(definition) - length(replace(definition, previous_guard, '')) <> length(previous_guard)
      or strpos(definition, change.new_guard) > 0
      or (previous_guard = change.hiking_only_guard and strpos(definition, change.wider_guard) > 0) then
      raise exception 'Unexpected Garmin activity-type guard in %', change.function_id;
    end if;
    execute replace(definition, previous_guard, change.new_guard);
  end loop;

  -- Recheck only previously type-rejected WALKING evidence using the existing
  -- validator. These reviews already passed the ingestion timestamp checks.
  -- Leave the original evidence, queue, records and publication keys intact.
  if not exists (
    select 1 from public.garmin_private_reviews
    where status = 'rejected' and reason = 'not-hiking'
      and evidence#>>'{activities,type}' = 'WALKING'
  ) then return; end if;

  if review_function = 'public.capture_garmin_private_review()'::regprocedure then
    capture_definition := pg_get_functiondef(review_function);
    if length(capture_definition) - length(replace(capture_definition, replay_guard, '')) <> length(replay_guard) then
      raise exception 'Unexpected Garmin capture trigger replay guard';
    end if;
    execute replace(capture_definition, replay_guard, replay_override);
    create temporary table garmin_walking_review_recheck (
      owner_id uuid, payload jsonb, feed text, received_at timestamptz
    ) on commit drop;
    create trigger check_walking_evidence after insert on garmin_walking_review_recheck
    for each row execute function public.capture_garmin_private_review();
    insert into garmin_walking_review_recheck(owner_id, payload, feed, received_at)
    select owner_id, jsonb_build_object('activityId', activity_id, 'privateEvidence', evidence->'activities'),
      'activities', statement_timestamp()
    from public.garmin_private_reviews
    where status = 'rejected' and reason = 'not-hiking'
      and evidence#>>'{activities,type}' = 'WALKING';
    execute capture_definition;
  else
    with checked as materialized (
      select r.owner_id, r.activity_id, public.evaluate_garmin_private_review(r, statement_timestamp()) as result
      from public.garmin_private_reviews r
      join public.garmin_connections c on c.user_id = r.owner_id
      where r.status = 'rejected' and r.reason = 'not-hiking'
        and r.evidence#>>'{activities,type}' = 'WALKING'
        and c.activity_export_revoked_at is null and c.deregistered_at is null
      for update of r
    )
    update public.garmin_private_reviews r
    set status = (checked.result).status, reason = (checked.result).reason,
      distance_km = (checked.result).distance_km, ascent_m = (checked.result).ascent_m,
      elapsed_hhmm = (checked.result).elapsed_hhmm
    from checked where r.owner_id = checked.owner_id and r.activity_id = checked.activity_id;
  end if;
end
$$;

commit;
