-- Apply through the project's normal Supabase migration workflow before enabling checkout.
begin;
create table public.shop_orders (
 id uuid primary key,
 access_token_hash text not null,
 provider text not null check (provider in ('stripe','paypal')),
 mode text not null check (mode in ('test','live')),
 quantity integer not null check (quantity between 1 and 10),
 unit_price_cents integer not null check (unit_price_cents > 0),
 shipping_cents integer not null check (shipping_cents >= 0),
 total_cents integer not null check (total_cents = quantity * unit_price_cents + shipping_cents),
 currency text not null check (currency = 'EUR'),
 address jsonb not null,
 shipping_method_uid text not null,
 provider_order_id text, checkout_url text,
 status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
 file_url text not null, file_sha256 text not null, product_uid text not null, page_count integer not null,
 created_at timestamptz not null default now(), paid_at timestamptz,
 unique(provider, mode, provider_order_id)
);
create table public.shop_payments (
 provider text not null, mode text not null, payment_id text not null,
 order_id uuid not null references public.shop_orders(id),
 amount_cents integer not null, currency text not null, created_at timestamptz not null default now(),
 primary key(provider, mode, payment_id), unique(order_id)
);
alter table public.shop_orders enable row level security;
alter table public.shop_payments enable row level security;
revoke all on public.shop_orders, public.shop_payments from anon, authenticated;
grant all on public.shop_orders, public.shop_payments to service_role;
create function public.shop_record_payment(p_order_id uuid, p_provider text, p_mode text, p_payment_id text, p_amount_cents integer, p_currency text, p_provider_order_id text) returns void
language plpgsql security definer set search_path = public as $$
declare o public.shop_orders;
begin
 select * into o from public.shop_orders where id = p_order_id for update;
 if not found or o.provider <> p_provider or o.mode <> p_mode or o.total_cents <> p_amount_cents or o.currency <> p_currency or o.provider_order_id is distinct from p_provider_order_id then
  raise exception 'Payment mismatch';
 end if;
 if o.status = 'paid' then
  if not exists(select 1 from public.shop_payments where order_id=o.id and payment_id=p_payment_id and provider=p_provider and mode=p_mode) then raise exception 'Payment conflict'; end if;
  return;
 end if;
 if o.status <> 'pending' then raise exception 'Invalid order state'; end if;
 insert into public.shop_payments(provider,mode,payment_id,order_id,amount_cents,currency) values(p_provider,p_mode,p_payment_id,p_order_id,p_amount_cents,p_currency);
 update public.shop_orders set status='paid', paid_at=now() where id=p_order_id;
end; $$;
revoke all on function public.shop_record_payment(uuid,text,text,text,integer,text,text) from public, anon, authenticated;
grant execute on function public.shop_record_payment(uuid,text,text,text,integer,text,text) to service_role;

create table public.shop_request_limits (key text primary key, window_start timestamptz not null, hits integer not null);
alter table public.shop_request_limits enable row level security;
revoke all on public.shop_request_limits from anon, authenticated;
create function public.shop_rate_limit(p_key text,p_limit integer) returns boolean language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 insert into public.shop_request_limits(key,window_start,hits) values(p_key,date_trunc('minute',now()),1)
 on conflict(key) do update set hits=case when shop_request_limits.window_start=date_trunc('minute',now()) then shop_request_limits.hits+1 else 1 end, window_start=date_trunc('minute',now()) returning hits into n;
 return n<=p_limit;
end; $$;
revoke all on function public.shop_rate_limit(text,integer) from public,anon,authenticated;
grant execute on function public.shop_rate_limit(text,integer) to service_role;

commit;
