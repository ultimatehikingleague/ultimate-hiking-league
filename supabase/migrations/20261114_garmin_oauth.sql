create table public.garmin_oauth_attempts (
  state_hash text primary key,
  browser_hash text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  verifier text not null,
  expires_at timestamptz not null
);

create index garmin_oauth_attempts_expiry_idx on public.garmin_oauth_attempts (expires_at);

create table public.garmin_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  garmin_user_id text not null unique,
  encrypted_tokens text not null,
  connected_at timestamptz not null
);

alter table public.garmin_oauth_attempts enable row level security;
alter table public.garmin_connections enable row level security;
revoke all on public.garmin_oauth_attempts, public.garmin_connections from public, anon, authenticated;
grant select, insert, delete on public.garmin_oauth_attempts to service_role;
grant select, insert on public.garmin_connections to service_role;
