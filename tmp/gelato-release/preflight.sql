SELECT current_database() AS database_name,
  (SELECT count(*) FROM public.shop_orders) AS orders,
  (SELECT count(*) FROM public.shop_payments) AS payments,
  (SELECT count(*) FROM public.shop_invoices) AS invoices,
  (SELECT count(*) FROM public.shop_fulfillment) AS fulfillments,
  (SELECT count(*) FROM public.shop_fulfillment WHERE mode='live' AND status='submitted' AND gelato_order_id IS NOT NULL) AS submitted_live,
  ARRAY(SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN (
      'shop_fulfillment_units','shop_fulfillment_unit_lines','shop_fulfillment_shipments',
      'shop_fulfillment_shipment_lines','shop_fulfillment_sync','shop_fulfillment_events','shop_tracking_discovery'
    )) AS existing_tracking_tables,
  ARRAY(SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname LIKE 'shop_tracking_%') AS existing_tracking_functions;
