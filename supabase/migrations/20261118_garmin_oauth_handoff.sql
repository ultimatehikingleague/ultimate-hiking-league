-- A callback can arrive in a browser without the initiating UHL session.
-- Only the service role can stage the first result for a live attempt.
alter table public.garmin_oauth_attempts add column callback_result text;
grant update (callback_result) on public.garmin_oauth_attempts to service_role;

create unique index garmin_oauth_attempts_browser_hash_idx
  on public.garmin_oauth_attempts (browser_hash);
