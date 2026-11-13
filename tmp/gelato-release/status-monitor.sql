SELECT now() AS measured_at,
 (SELECT count(*) FROM public.shop_orders) AS orders,
 (SELECT count(*) FROM public.shop_payments) AS payments,
 (SELECT count(*) FROM public.shop_invoices) AS invoices,
 (SELECT count(*) FROM public.shop_fulfillment) AS fulfillments,
 (SELECT count(*) FROM public.shop_fulfillment_events WHERE source='poll') AS status_events,
 (SELECT max(last_attempt_at) FROM public.shop_fulfillment_sync) AS last_status_attempt,
 (SELECT max(next_scan_at) FROM public.shop_tracking_discovery) AS next_discovery,
 coalesce(sum(calls) FILTER (WHERE query ~ 'shop_tracking_claim'),0) AS claim_calls,
 round(coalesce(sum(total_exec_time) FILTER (WHERE query ~ 'shop_tracking_claim'),0)::numeric,3) AS claim_exec_ms,
 coalesce(sum(calls) FILTER (WHERE query ~ 'shop_tracking_apply'),0) AS apply_calls
FROM extensions.pg_stat_statements
WHERE query !~ 'pg_stat_statements' AND query ~ 'shop_tracking_(claim|apply)';
