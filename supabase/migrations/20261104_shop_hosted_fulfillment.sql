begin;
alter table public.shop_fulfillment drop constraint shop_fulfillment_status_check;
alter table public.shop_fulfillment add constraint shop_fulfillment_status_check check(status in ('pending','processing','draft','submitted','review'));
create function public.shop_claim_fulfillment(p_mode text) returns setof public.shop_fulfillment
language plpgsql security definer set search_path=public as $$
declare selected_id uuid;
begin
 if p_mode not in ('test','live') then raise exception 'Invalid mode'; end if;
 update public.shop_fulfillment set status='review',last_error='Interrupted transfer: reconcile with supplier before retry'
 where status='processing' and mode=p_mode and started_at < now()-interval '10 minutes';
 select f.order_id into selected_id from public.shop_fulfillment f join public.shop_orders o on o.id=f.order_id
 where f.status='pending' and f.mode=p_mode and o.mode=p_mode and o.status='paid'
 order by f.created_at for update of f skip locked limit 1;
 if selected_id is null then return; end if;
 return query update public.shop_fulfillment set status='processing',claim_token=gen_random_uuid(),attempts=attempts+1,started_at=now()
 where order_id=selected_id returning *;
end; $$;
revoke all on function public.shop_claim_fulfillment(text) from public,anon,authenticated;
grant execute on function public.shop_claim_fulfillment(text) to service_role;
commit;
