begin;

create table public.milestone_partner_benefits (
  id bigint generated always as identity primary key,
  title text not null check (btrim(title) <> ''),
  partner_name text not null check (btrim(partner_name) <> ''),
  description text,
  reward_type text not null check (reward_type in ('benefit', 'affiliate')),
  image_url text check (image_url ~ '^https://[^[:space:]]+$'),
  redemption_url text not null check (redemption_url ~ '^https://[^[:space:]]+$'),
  redemption_instructions text,
  shared_code text check (btrim(shared_code) <> ''),
  is_active boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.milestone_partner_benefits enable row level security;
revoke all on public.milestone_partner_benefits from public, anon, authenticated;
grant select, insert, update on public.milestone_partner_benefits to authenticated;
grant usage on sequence public.milestone_partner_benefits_id_seq to authenticated;

create policy milestone_benefits_read on public.milestone_partner_benefits
  for select to authenticated using (
    (is_active and public.milestone_shop_is_live())
    or exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  );
create policy milestone_benefits_insert on public.milestone_partner_benefits
  for insert to authenticated with check (
    exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  );
create policy milestone_benefits_update on public.milestone_partner_benefits
  for update to authenticated using (
    exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  );

commit;
