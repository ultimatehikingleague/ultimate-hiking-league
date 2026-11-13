begin;
create table public.shop_withdrawals (
 id uuid primary key, name text not null, email text not null, contract_reference text not null,
 received_at timestamptz not null default now(), confirmation_sent_at timestamptz,
 owner_notified_at timestamptz
);
alter table public.shop_withdrawals enable row level security;
revoke all on public.shop_withdrawals from public,anon,authenticated;
grant select,insert,update on public.shop_withdrawals to service_role;
-- Claim the confirmation before sending; ambiguous failures require review instead of duplicate mail.
alter table public.shop_invoices add column confirmation_started_at timestamptz;
commit;
