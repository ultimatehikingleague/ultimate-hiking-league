-- The record triggers call application functions and tables in public.
-- Resolve those dependencies while keeping pg_temp last in both definer entry points.
alter function public.publish_garmin_activity(uuid, bigint, text, text, timestamptz, jsonb, jsonb)
  set search_path = pg_catalog, public, pg_temp;

alter function public.approve_garmin_event_submission(bigint, bigint, bigint, numeric, text)
  set search_path = pg_catalog, public, pg_temp;
