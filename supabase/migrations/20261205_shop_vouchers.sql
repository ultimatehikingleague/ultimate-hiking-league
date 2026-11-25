begin;

create table public.shop_vouchers (
  code text primary key check (code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'),
  mode text not null check (mode in ('test','live')),
  kind text not null check (kind in ('percent','fixed')),
  value integer not null check (value > 0 and (kind <> 'percent' or value <= 100)),
  sku text references public.shop_catalog_products(sku),
  starts_at timestamptz,
  ends_at timestamptz,
  minimum_cents integer not null default 0 check (minimum_cents >= 0),
  usage_limit integer check (usage_limit > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (code,mode),
  check (ends_at > starts_at)
);

alter table public.shop_orders
  add column voucher_code text,
  add column discount_cents integer not null default 0,
  add column voucher_expires_at timestamptz,
  add column voucher_checked_at timestamptz,
  add column voucher_capture_started boolean not null default false,
  drop constraint shop_orders_check,
  drop constraint shop_orders_provider_check,
  add constraint shop_orders_voucher_mode_fkey foreign key (voucher_code,mode) references public.shop_vouchers(code,mode),
  add constraint shop_orders_provider_check check (provider in ('stripe','paypal','free')),
  add constraint shop_orders_total_cents_check check (
    discount_cents between 0 and (quantity * unit_price_cents)
    and total_cents = quantity * unit_price_cents + shipping_cents - discount_cents
    and ((voucher_code is null and discount_cents = 0 and voucher_expires_at is null)
      or (voucher_code is not null and discount_cents > 0 and voucher_expires_at is not null))
    and ((provider = 'free') = (total_cents = 0))
  );

create index shop_orders_voucher_usage on public.shop_orders(voucher_code,mode,status) where voucher_code is not null;
create index shop_orders_voucher_expiry on public.shop_orders(mode,voucher_expires_at)
  where voucher_code is not null and status = 'pending';

alter table public.shop_vouchers enable row level security;
revoke all on public.shop_vouchers from public,anon,authenticated;
grant select,insert,update on public.shop_vouchers to service_role;

-- A row lock on the voucher serializes competing checkout attempts and admin toggles.
create function public.shop_voucher_discount(p_code text,p_sku text,p_subtotal integer,p_mode text)
returns integer language plpgsql security invoker set search_path=public as $$
declare v public.shop_vouchers; discount integer;
begin
  select * into v from public.shop_vouchers where code = p_code and mode = p_mode for update;
  if not found or not v.active or (v.sku is not null and v.sku <> p_sku)
    or v.starts_at > clock_timestamp() or v.ends_at <= clock_timestamp()
    or v.minimum_cents > p_subtotal
    or (v.usage_limit is not null and v.usage_limit <= (
      select count(*) from public.shop_orders where voucher_code=p_code and mode=p_mode
      and status in ('pending','paid','refunded')
    )) then
    raise exception using errcode='P0001', message='voucher_unavailable';
  end if;
  discount := case v.kind when 'percent' then round(p_subtotal::numeric * v.value / 100)
    else least(v.value,p_subtotal) end;
  if discount <= 0 then raise exception using errcode='P0001', message='voucher_unavailable'; end if;
  return discount;
end; $$;

-- Insert the priced order and its reservation in the same transaction.
create function public.shop_reserve_voucher_order(p_order jsonb,p_code text,p_expected_discount integer)
returns void language plpgsql security invoker set search_path=public as $$
declare o public.shop_orders; discount integer;
begin
  o := jsonb_populate_record(null::public.shop_orders,p_order);
  perform pg_advisory_xact_lock(hashtextextended(o.id::text,0));
  if exists(select 1 from public.shop_orders where id=o.id) then return; end if;
  discount := public.shop_voucher_discount(p_code,o.sku,o.quantity*o.unit_price_cents,o.mode);
  if discount <> p_expected_discount then
    raise exception using errcode='P0001', message='voucher_unavailable';
  end if;
  insert into public.shop_orders(id,access_token_hash,provider,mode,sku,product_name,quantity,unit_price_cents,
    shipping_cents,total_cents,currency,address,shipping_method_uid,file_url,file_sha256,product_uid,page_count,
    voucher_code,discount_cents,voucher_expires_at)
  values(o.id,o.access_token_hash,case when o.total_cents=0 then 'free' else o.provider end,o.mode,o.sku,
    o.product_name,o.quantity,o.unit_price_cents,o.shipping_cents,o.total_cents,o.currency,o.address,
    o.shipping_method_uid,o.file_url,o.file_sha256,o.product_uid,o.page_count,p_code,discount,
    clock_timestamp()+interval '45 minutes');
  if o.total_cents=0 then
    perform public.shop_record_payment(o.id,'free',o.mode,'free-'||o.id,0,o.currency,null);
  end if;
end; $$;

create function public.shop_claim_voucher_capture(p_order_id uuid) returns boolean
language plpgsql security invoker set search_path=public as $$
begin
  update public.shop_orders set voucher_capture_started=true
  where id=p_order_id and voucher_code is not null and provider='paypal' and status='pending'
    and (voucher_capture_started or voucher_expires_at>clock_timestamp());
  return found;
end; $$;

-- Provider verification is required for linked Stripe sessions or an attempted PayPal capture.
create function public.shop_release_voucher_order(p_order_id uuid,p_provider_final boolean) returns void
language sql security invoker set search_path=public as $$
  update public.shop_orders set status='failed'
  where id=p_order_id and voucher_code is not null and status='pending'
    and (p_provider_final or (voucher_expires_at <= clock_timestamp() and not voucher_capture_started
      and (provider='paypal' or provider_order_id is null)));
$$;

revoke all on function public.shop_voucher_discount(text,text,integer,text),
  public.shop_reserve_voucher_order(jsonb,text,integer),public.shop_claim_voucher_capture(uuid),
  public.shop_release_voucher_order(uuid,boolean) from public,anon,authenticated;
grant execute on function public.shop_voucher_discount(text,text,integer,text),
  public.shop_reserve_voucher_order(jsonb,text,integer),public.shop_claim_voucher_capture(uuid),
  public.shop_release_voucher_order(uuid,boolean) to service_role;

create or replace function public.shop_issue_invoice(p_order_id uuid,p_seller jsonb,p_terms jsonb) returns setof public.shop_invoices
language plpgsql security definer set search_path=public as $$
declare o public.shop_orders; lines jsonb; subtotal bigint;
begin
 select * into o from public.shop_orders where id=p_order_id for update;
 if not found or o.status <> 'paid' then raise exception 'Paid order required'; end if;
 if exists(select 1 from public.shop_invoices where order_id=o.id) then return query select * from public.shop_invoices where order_id=o.id; return; end if;
 if o.mode='live' and coalesce(p_seller->>'taxNumber','')='' then raise exception 'Seller tax number required'; end if;
 select jsonb_agg(to_jsonb(l) order by l.line_number),sum(l.total_cents) into lines,subtotal from public.shop_order_lines l where l.order_id=o.id;
 if lines is null or subtotal+o.shipping_cents-o.discount_cents<>o.total_cents then raise exception 'Invoice totals mismatch'; end if;
 insert into public.shop_invoices(order_id,number,mode,snapshot)
 values(o.id,public.uhl_next_invoice_number(o.mode),o.mode,
 jsonb_build_object('seller',p_seller,'buyer',o.address,'lines',lines,'shippingCents',o.shipping_cents,'discountCents',o.discount_cents,'totalCents',o.total_cents,'currency',o.currency,'country',o.address->>'country','paidAt',o.paid_at,'provider',o.provider,'terms',p_terms));
 return query select * from public.shop_invoices where order_id=o.id;
end; $$;

create function public.shop_admin_voucher_list(p_after text,p_mode text)
returns setof jsonb language sql stable security invoker set search_path=public as $$
  select to_jsonb(v) || jsonb_build_object(
    'used', usage.used, 'reserved', usage.reserved,
    'status', case
      when not v.active then 'inactive'
      when v.starts_at > now() then 'scheduled'
      when v.ends_at <= now() then 'expired'
      when usage.used >= v.usage_limit then 'exhausted'
      when usage.used + usage.reserved >= v.usage_limit then 'reserved'
      else 'active' end
  )
  from (select * from public.shop_vouchers where mode=p_mode and code > p_after order by code limit 101) v
  cross join lateral (
    select count(*) filter (where status in ('paid','refunded')) as used,
      count(*) filter (where status='pending') as reserved
    from public.shop_orders where voucher_code=v.code and mode=p_mode
      and status in ('paid','refunded','pending')
  ) usage
  order by v.code;
$$;
revoke all on function public.shop_admin_voucher_list(text,text) from public,anon,authenticated;
grant execute on function public.shop_admin_voucher_list(text,text) to service_role;

commit;
