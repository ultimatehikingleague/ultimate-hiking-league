begin;

-- Use the existing Outdoor Store counter for every UHL invoice.
-- Call only from the transaction that inserts the final invoice.
create function public.uhl_next_invoice_number(p_mode text) returns text
language plpgsql security invoker set search_path=public as $$
declare
  invoice_year integer := extract(year from now() at time zone 'Europe/Berlin');
  invoice_sequence bigint;
begin
  if p_mode is null or p_mode not in ('live', 'test') then
    raise exception 'Invalid invoice mode';
  end if;

  insert into public.shop_invoice_counters(year, mode, last_number)
  values(invoice_year, p_mode, 1)
  on conflict(year, mode) do update
    set last_number = shop_invoice_counters.last_number + 1
  returning last_number into invoice_sequence;

  return (case when p_mode = 'test' then 'TEST-' else 'UHL-' end)
    || invoice_year || '-' || lpad(invoice_sequence::text, greatest(6, length(invoice_sequence::text)), '0');
end;
$$;

revoke all on function public.uhl_next_invoice_number(text) from public, anon, authenticated, service_role;

create or replace function public.shop_issue_invoice(p_order_id uuid,p_seller jsonb,p_terms jsonb) returns setof public.shop_invoices
language plpgsql security definer set search_path=public as $$
declare o public.shop_orders; lines jsonb; subtotal bigint;
begin
 select * into o from public.shop_orders where id=p_order_id for update;
 if not found or o.status <> 'paid' then raise exception 'Paid order required'; end if;
 if exists(select 1 from public.shop_invoices where order_id=o.id) then return query select * from public.shop_invoices where order_id=o.id; return; end if;
 if o.mode='live' and coalesce(p_seller->>'taxNumber','')='' then raise exception 'Seller tax number required'; end if;
 select jsonb_agg(to_jsonb(l) order by l.line_number),sum(l.total_cents) into lines,subtotal from public.shop_order_lines l where l.order_id=o.id;
 if lines is null or subtotal+o.shipping_cents<>o.total_cents then raise exception 'Invoice totals mismatch'; end if;
 insert into public.shop_invoices(order_id,number,mode,snapshot)
 values(o.id,public.uhl_next_invoice_number(o.mode),o.mode,
 jsonb_build_object('seller',p_seller,'buyer',o.address,'lines',lines,'shippingCents',o.shipping_cents,'totalCents',o.total_cents,'currency',o.currency,'country',o.address->>'country','paidAt',o.paid_at,'provider',o.provider,'terms',p_terms));
 return query select * from public.shop_invoices where order_id=o.id;
end; $$;

commit;
