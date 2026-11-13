begin;
-- Durable handoff queue. Test and live orders stay separated; no production API here.
create table public.shop_fulfillment (
 order_id uuid primary key references public.shop_orders(id),
 mode text not null check (mode in ('test','live')),
 status text not null default 'pending' check (status in ('pending','processing','draft','review')),
 gelato_order_id text unique,
 claim_token uuid,
 attempts integer not null default 0,
 started_at timestamptz,
 completed_at timestamptz,
 last_error text,
 created_at timestamptz not null default now()
);
alter table public.shop_fulfillment enable row level security;
revoke all on public.shop_fulfillment from public,anon,authenticated;
grant select,insert,update on public.shop_fulfillment to service_role;

create function public.shop_enqueue_fulfillment() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.status='paid' and old.status is distinct from 'paid' then
  insert into public.shop_fulfillment(order_id,mode) values(new.id,new.mode) on conflict(order_id) do nothing;
 end if;
 return new;
end; $$;
revoke all on function public.shop_enqueue_fulfillment() from public,anon,authenticated;
create trigger shop_paid_fulfillment after update of status on public.shop_orders
for each row execute function public.shop_enqueue_fulfillment();

create function public.shop_claim_test_fulfillment() returns setof public.shop_fulfillment
language plpgsql security definer set search_path=public as $$
declare selected_id uuid;
begin
 -- A timed-out create may have succeeded at Gelato. Never silently retry it.
 update public.shop_fulfillment set status='review',last_error='Interrupted transfer: reconcile with Gelato before retry'
 where status='processing' and mode='test' and started_at < now()-interval '5 minutes';
 select f.order_id into selected_id from public.shop_fulfillment f
 join public.shop_orders o on o.id=f.order_id
 where f.status='pending' and f.mode='test' and o.mode='test' and o.status='paid'
 order by f.created_at for update of f skip locked limit 1;
 if selected_id is null then return; end if;
 return query update public.shop_fulfillment set status='processing',claim_token=gen_random_uuid(),attempts=attempts+1,started_at=now()
 where order_id=selected_id returning *;
end; $$;
revoke all on function public.shop_claim_test_fulfillment() from public,anon,authenticated;
grant execute on function public.shop_claim_test_fulfillment() to service_role;
-- Existing paid test orders are deliberately NOT backfilled: one already has a draft.
commit;
