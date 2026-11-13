begin;
create table public.shop_catalog_products (
 sku text primary key, name text not null, unit_price_cents integer not null check(unit_price_cents>0),
 currency text not null default 'EUR' check(currency='EUR'), active boolean not null default false,
 gelato_product_uid text not null, file_url text not null, file_sha256 text not null, page_count integer not null check(page_count>0)
);
insert into public.shop_catalog_products values ('UHL-KAL-2027-A3','Schorschys Wanderkalender 2027',2990,'EUR',true,
'wall-calendars_pf_a3_pt_250-gsm-coated-silk_cl_4-4_bt_wire-with-hook-top_ver',
'https://astdepkrdkmufsydxviz.supabase.co/storage/v1/object/public/print-files/calendars/2027/schorschys-a3-300dpi-d42ee835e4e82f5f.pdf',
'd42ee835e4e82f5fb05f02073583f7f1aa4f8e7cc4ca6ee2f12ddb88707656c8',14);
create table public.shop_shipping_regions (
 country text primary key check(country in ('DE','AT','CH')), name text not null, enabled boolean not null default false,
 pricing_policy text not null default 'gelato_shipping_only' check(pricing_policy='gelato_shipping_only')
);
insert into public.shop_shipping_regions values ('DE','Deutschland',true,'gelato_shipping_only'),('AT','Österreich',true,'gelato_shipping_only'),('CH','Schweiz',true,'gelato_shipping_only');
alter table public.shop_orders add column sku text not null default 'UHL-KAL-2027-A3' references public.shop_catalog_products(sku), add column product_name text not null default 'Schorschys Wanderkalender 2027';
create table public.shop_order_lines (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.shop_orders(id),
 line_number integer not null, sku text not null, name text not null,
 quantity integer not null check(quantity>0), unit_price_cents integer not null check(unit_price_cents>=0),
 total_cents integer not null check(total_cents=quantity*unit_price_cents), unique(order_id,line_number)
);
create function public.shop_snapshot_order_line() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.shop_order_lines(order_id,line_number,sku,name,quantity,unit_price_cents,total_cents)
 values(new.id,1,new.sku,new.product_name,new.quantity,new.unit_price_cents,new.quantity*new.unit_price_cents);
 return new;
end; $$;
revoke all on function public.shop_snapshot_order_line() from public,anon,authenticated;
create trigger shop_order_line_snapshot after insert on public.shop_orders for each row execute function public.shop_snapshot_order_line();
insert into public.shop_order_lines(order_id,line_number,sku,name,quantity,unit_price_cents,total_cents)
select id,1,sku,product_name,quantity,unit_price_cents,quantity*unit_price_cents from public.shop_orders;
create table public.shop_invoice_counters (year integer not null, mode text not null, last_number bigint not null,primary key(year,mode));
create table public.shop_invoices (
 order_id uuid primary key references public.shop_orders(id), number text unique not null,
 issued_at timestamptz not null default now(), mode text not null check(mode in ('test','live')),
 snapshot jsonb not null, pdf_base64 text, confirmation_sent_at timestamptz
);
create function public.shop_issue_invoice(p_order_id uuid,p_seller jsonb,p_terms jsonb) returns setof public.shop_invoices
language plpgsql security definer set search_path=public as $$
declare o public.shop_orders; n bigint; y integer; lines jsonb; subtotal bigint;
begin
 select * into o from public.shop_orders where id=p_order_id for update;
 if not found or o.status <> 'paid' then raise exception 'Paid order required'; end if;
 if exists(select 1 from public.shop_invoices where order_id=o.id) then return query select * from public.shop_invoices where order_id=o.id; return; end if;
 if o.mode='live' and coalesce(p_seller->>'taxNumber','')='' then raise exception 'Seller tax number required'; end if;
 select jsonb_agg(to_jsonb(l) order by l.line_number),sum(l.total_cents) into lines,subtotal from public.shop_order_lines l where l.order_id=o.id;
 if lines is null or subtotal+o.shipping_cents<>o.total_cents then raise exception 'Invoice totals mismatch'; end if;
 y=extract(year from now() at time zone 'Europe/Berlin');
 insert into public.shop_invoice_counters(year,mode,last_number) values(y,o.mode,1)
 on conflict(year,mode) do update set last_number=shop_invoice_counters.last_number+1 returning last_number into n;
 insert into public.shop_invoices(order_id,number,mode,snapshot) values(o.id,
 case when o.mode='test' then 'TEST-' else 'UHL-' end || y || '-' || lpad(n::text,6,'0'),o.mode,
 jsonb_build_object('seller',p_seller,'buyer',o.address,'lines',lines,'shippingCents',o.shipping_cents,'totalCents',o.total_cents,'currency',o.currency,'country',o.address->>'country','paidAt',o.paid_at,'provider',o.provider,'terms',p_terms));
 return query select * from public.shop_invoices where order_id=o.id;
end; $$;
revoke all on function public.shop_issue_invoice(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.shop_issue_invoice(uuid,jsonb,jsonb) to service_role;

alter table public.shop_catalog_products enable row level security;
alter table public.shop_shipping_regions enable row level security;
alter table public.shop_order_lines enable row level security;
alter table public.shop_invoice_counters enable row level security;
alter table public.shop_invoices enable row level security;
revoke all on public.shop_catalog_products,public.shop_shipping_regions,public.shop_order_lines,public.shop_invoice_counters,public.shop_invoices from public,anon,authenticated;
grant select on public.shop_catalog_products,public.shop_shipping_regions,public.shop_order_lines to service_role;
grant select,update on public.shop_invoices to service_role;
commit;
