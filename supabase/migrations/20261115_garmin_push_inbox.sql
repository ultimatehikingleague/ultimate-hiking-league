create table public.garmin_push_inbox (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.garmin_connections(user_id) on delete cascade,
  feed text not null check (feed in ('activities', 'activityDetails', 'activityFiles')),
  fingerprint text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  unique (owner_id, feed, fingerprint)
);

alter table public.garmin_push_inbox enable row level security;
revoke all on public.garmin_push_inbox from public, anon, authenticated;
grant select, insert on public.garmin_push_inbox to service_role;

-- Supabase grants sequence privileges separately from table privileges.
revoke all on sequence public.garmin_push_inbox_id_seq from public, anon, authenticated, service_role;
grant usage on sequence public.garmin_push_inbox_id_seq to service_role;

create function public.enqueue_garmin_push(p_feed text, p_items jsonb)
returns void
language sql
set search_path = ''
as $$
  insert into public.garmin_push_inbox (owner_id, feed, fingerprint, payload)
  select connection.user_id, p_feed, item.fingerprint, item.payload
  from pg_catalog.jsonb_to_recordset(p_items)
    as item(garmin_user_id text, fingerprint text, payload jsonb)
  join public.garmin_connections as connection
    on connection.garmin_user_id = item.garmin_user_id
  on conflict (owner_id, feed, fingerprint) do nothing;
$$;

revoke all on function public.enqueue_garmin_push(text, jsonb) from public, anon, authenticated;
grant execute on function public.enqueue_garmin_push(text, jsonb) to service_role;
