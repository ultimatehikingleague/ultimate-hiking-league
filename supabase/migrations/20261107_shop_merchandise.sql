-- Auftrag 4. Private preparation only. Apply to production after explicit approval.
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '15s';

-- The legacy editorial table has direct authenticated write policies and a public
-- active policy. Keep the new lifecycle and inventory behind a separate boundary.
CREATE TABLE public.shop_merchandise (
  sku text PRIMARY KEY CHECK (sku ~ '^[A-Z0-9][A-Z0-9_-]{1,63}$'),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 10000),
  price_cents integer CHECK (price_cents > 0),
  category text NOT NULL DEFAULT '' CHECK (char_length(category) <= 120),
  product_world text NOT NULL CHECK (product_world IN ('league','outdoor')),
  collection text NOT NULL DEFAULT '' CHECK (char_length(collection) <= 120),
  image_urls text[] NOT NULL DEFAULT '{}' CHECK (cardinality(image_urls) <= 12),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','archived')),
  fulfillment_type text NOT NULL CHECK (fulfillment_type IN ('self','gelato')),
  parent_sku text REFERENCES public.shop_merchandise(sku) CHECK (parent_sku IS DISTINCT FROM sku),
  stock_on_hand integer NOT NULL DEFAULT 0 CHECK (stock_on_hand >= 0),
  stock_reserved integer NOT NULL DEFAULT 0 CHECK (stock_reserved BETWEEN 0 AND stock_on_hand),
  stock_sold integer NOT NULL DEFAULT 0 CHECK (stock_sold >= 0),
  version uuid NOT NULL DEFAULT gen_random_uuid(),
  CHECK (status <> 'active' OR price_cents IS NOT NULL),
  CHECK (fulfillment_type = 'self' OR (stock_on_hand = 0 AND stock_sold = 0))
);

CREATE TABLE public.shop_inventory_entries (
  id uuid PRIMARY KEY,
  sku text NOT NULL REFERENCES public.shop_merchandise(sku),
  order_line_id uuid UNIQUE REFERENCES public.shop_order_lines(id),
  quantity integer NOT NULL CHECK (quantity <> 0),
  state text NOT NULL CHECK (state IN ('adjustment','reserved','sold','released')),
  reason text CHECK (char_length(reason) BETWEEN 1 AND 250),
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  CHECK (
    (state = 'adjustment' AND order_line_id IS NULL AND reason IS NOT NULL)
    OR (state <> 'adjustment' AND order_line_id IS NOT NULL AND quantity > 0)
  )
);
CREATE INDEX ON public.shop_inventory_entries(sku, created_at DESC);

ALTER TABLE public.shop_merchandise ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_inventory_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shop_merchandise, public.shop_inventory_entries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.shop_merchandise TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.shop_inventory_entries TO service_role;

INSERT INTO public.shop_merchandise (sku,name,category,product_world,fulfillment_type,stock_on_hand)
VALUES ('UHL-PATCH-001','ULTIMATE HIKING LEAGUE Aufnäher','Aufnäher','league','self',98);
INSERT INTO public.shop_inventory_entries (id,sku,quantity,state,reason)
VALUES (gen_random_uuid(),'UHL-PATCH-001',98,'adjustment','Erfasster Ausgangsbestand');

CREATE FUNCTION public.shop_adjust_inventory(p_sku text,p_delta integer,p_request uuid,p_actor uuid,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE product public.shop_merchandise; entry public.shop_inventory_entries;
BEGIN
  IF p_delta IS NULL OR p_delta = 0 OR p_actor IS NULL OR p_request IS NULL
      OR NULLIF(btrim(p_reason),'') IS NULL THEN
    RAISE EXCEPTION 'Adjustment needs an actor, request, amount and reason' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO product FROM public.shop_merchandise WHERE sku = p_sku FOR UPDATE;
  IF NOT FOUND OR product.fulfillment_type <> 'self' THEN
    RAISE EXCEPTION 'Self fulfillment product required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO entry FROM public.shop_inventory_entries WHERE id = p_request;
  IF FOUND THEN
    IF (entry.sku,entry.quantity,entry.actor_id,entry.reason) IS DISTINCT FROM
        (p_sku,p_delta,p_actor,p_reason) OR entry.state <> 'adjustment' THEN
      RAISE EXCEPTION 'Adjustment request conflicts with existing entry' USING ERRCODE = '23505';
    END IF;
    RETURN to_jsonb(product);
  END IF;
  IF product.stock_on_hand::bigint + p_delta < product.stock_reserved THEN
    RAISE EXCEPTION 'Adjustment would consume reserved stock' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.shop_inventory_entries (id,sku,quantity,state,actor_id,reason)
    VALUES (p_request,p_sku,p_delta,'adjustment',p_actor,p_reason);
  UPDATE public.shop_merchandise SET stock_on_hand = stock_on_hand + p_delta WHERE sku = p_sku RETURNING * INTO product;
  RETURN to_jsonb(product);
END;
$$;

-- Dormant building block for a separately approved checkout. Order lock comes
-- first, matching shop_record_payment, then the SKU lock for competing orders.
CREATE FUNCTION public.shop_reserve_inventory(p_order_line uuid)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE line public.shop_order_lines; orders public.shop_orders; product public.shop_merchandise;
BEGIN
  SELECT * INTO line FROM public.shop_order_lines WHERE id = p_order_line;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order line required'; END IF;
  SELECT * INTO orders FROM public.shop_orders WHERE id = line.order_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.shop_inventory_entries WHERE order_line_id = line.id AND state IN ('reserved','sold')) THEN
    RETURN;
  END IF;
  IF orders.mode <> 'live' OR orders.status <> 'pending' THEN RAISE EXCEPTION 'Pending live order required'; END IF;
  SELECT * INTO product FROM public.shop_merchandise WHERE sku = line.sku FOR UPDATE;
  IF NOT FOUND OR product.fulfillment_type <> 'self' OR product.status <> 'active'
      OR product.price_cents IS DISTINCT FROM line.unit_price_cents THEN
    RAISE EXCEPTION 'Order line is not an eligible self fulfillment SKU';
  END IF;
  IF product.stock_on_hand - product.stock_reserved < line.quantity THEN RAISE EXCEPTION 'Insufficient stock'; END IF;
  INSERT INTO public.shop_inventory_entries(id,sku,order_line_id,quantity,state)
    VALUES (gen_random_uuid(),line.sku,line.id,line.quantity,'reserved');
  UPDATE public.shop_merchandise SET stock_reserved = stock_reserved + line.quantity WHERE sku = line.sku;
END;
$$;

-- Release requires an authoritative terminal failed order and evidence. A browser
-- cancellation, a timeout or an unverified provider event cannot release stock.
CREATE FUNCTION public.shop_settle_inventory(p_order_line uuid,p_target text,p_failure_reference text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE entry public.shop_inventory_entries; orders public.shop_orders; unit uuid;
BEGIN
  SELECT o.* INTO orders FROM public.shop_orders o
    JOIN public.shop_order_lines l ON l.order_id = o.id WHERE l.id = p_order_line FOR UPDATE OF o;
  IF NOT FOUND OR orders.mode <> 'live' THEN RAISE EXCEPTION 'Live order required'; END IF;
  SELECT * INTO entry FROM public.shop_inventory_entries WHERE order_line_id = p_order_line FOR UPDATE;
  IF NOT FOUND OR p_target IS NULL OR p_target NOT IN ('sold','released') THEN RAISE EXCEPTION 'Invalid inventory transition'; END IF;
  IF entry.state = p_target THEN RETURN; END IF;
  IF entry.state <> 'reserved' THEN RAISE EXCEPTION 'Inventory is no longer reserved'; END IF;
  IF p_target = 'sold' THEN
    IF orders.status <> 'paid' OR NOT EXISTS (
        SELECT 1 FROM public.shop_payments p WHERE p.order_id = orders.id
          AND p.mode = orders.mode AND p.provider = orders.provider
          AND p.amount_cents = orders.total_cents AND p.currency = orders.currency
    ) THEN RAISE EXCEPTION 'Verified payment required'; END IF;
    UPDATE public.shop_merchandise SET stock_reserved = stock_reserved - entry.quantity,
      stock_on_hand = stock_on_hand - entry.quantity, stock_sold = stock_sold + entry.quantity WHERE sku = entry.sku;
    INSERT INTO public.shop_fulfillment_units(order_id,mode,provider,external_order_id,shipping_status)
      VALUES (orders.id,orders.mode,'self',p_order_line::text,'ready') RETURNING id INTO unit;
    INSERT INTO public.shop_fulfillment_unit_lines(unit_id,order_id,order_line_id,quantity)
      VALUES (unit,orders.id,p_order_line,entry.quantity);
  ELSE
    IF orders.status <> 'failed' OR NULLIF(btrim(p_failure_reference),'') IS NULL THEN
      RAISE EXCEPTION 'Terminal failure evidence required';
    END IF;
    UPDATE public.shop_merchandise SET stock_reserved = stock_reserved - entry.quantity WHERE sku = entry.sku;
  END IF;
  UPDATE public.shop_inventory_entries SET state = p_target, settled_at = now(),
    reason = CASE WHEN p_target = 'released' THEN p_failure_reference END WHERE id = entry.id;
END;
$$;

CREATE FUNCTION public.shop_confirm_self_shipping(
  p_unit uuid,p_status text,p_actor uuid,p_carrier text,p_tracking_number text,p_tracking_url text
) RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE unit public.shop_fulfillment_units; package uuid; confirmed_at timestamptz := now();
BEGIN
  IF p_actor IS NULL OR p_status IS NULL OR p_status NOT IN ('shipped','delivered') THEN
    RAISE EXCEPTION 'Invalid shipping confirmation' USING ERRCODE = '22023';
  END IF;
  -- Lock order before unit so a concurrent refund cannot race a shipment.
  PERFORM 1 FROM public.shop_orders o JOIN public.shop_fulfillment_units u ON u.order_id = o.id
    WHERE u.id = p_unit AND u.provider = 'self' AND o.status = 'paid' FOR UPDATE OF o;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paid self fulfillment required' USING ERRCODE = '22023'; END IF;
  SELECT * INTO unit FROM public.shop_fulfillment_units WHERE id = p_unit AND provider = 'self' FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.shop_fulfillment_unit_lines l
      JOIN public.shop_inventory_entries i ON i.order_line_id = l.order_line_id AND i.state = 'sold'
    WHERE l.unit_id = p_unit
  ) THEN RAISE EXCEPTION 'Sold self fulfillment required' USING ERRCODE = '22023'; END IF;
  IF p_status = 'shipped' THEN
    IF unit.shipping_status = 'shipped' THEN
      IF EXISTS (SELECT 1 FROM public.shop_fulfillment_shipments s WHERE s.unit_id = p_unit
          AND s.external_package_id = 'self-1' AND (s.carrier,s.tracking_number,s.tracking_url)
            IS NOT DISTINCT FROM (p_carrier,p_tracking_number,p_tracking_url)) THEN
        RETURN;
      END IF;
      RAISE EXCEPTION 'Shipment already confirmed with different details' USING ERRCODE = '22023';
    END IF;
    IF unit.shipping_status <> 'ready' OR NULLIF(btrim(p_carrier),'') IS NULL
        OR char_length(p_carrier) > 120 OR char_length(p_tracking_number) > 120
        OR (p_tracking_url IS NOT NULL AND (char_length(p_tracking_url) > 2048
          OR p_tracking_url !~ '^https://[^/@[:space:]]+([/?#]|$)' OR p_tracking_url ~ '[[:space:]]'
          OR strpos(p_tracking_url,chr(92)) > 0)) THEN
      RAISE EXCEPTION 'Invalid shipment details or state' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.shop_fulfillment_shipments(unit_id,external_package_id,shipping_status,
        carrier,tracking_number,tracking_url,shipped_at,timestamp_source)
      VALUES (p_unit,'self-1','shipped',p_carrier,p_tracking_number,p_tracking_url,confirmed_at,'admin') RETURNING id INTO package;
    INSERT INTO public.shop_fulfillment_shipment_lines(shipment_id,unit_line_id,unit_id,quantity)
      SELECT package,id,unit_id,quantity FROM public.shop_fulfillment_unit_lines WHERE unit_id = p_unit;
    UPDATE public.shop_fulfillment_units SET shipping_status = 'shipped',updated_at = confirmed_at WHERE id = p_unit;
  ELSE
    IF unit.delivery_status = 'delivered' THEN RETURN; END IF;
    IF unit.shipping_status <> 'shipped' OR unit.delivery_status <> 'unknown' THEN
      RAISE EXCEPTION 'Shipment confirmation required before delivery' USING ERRCODE = '22023';
    END IF;
    UPDATE public.shop_fulfillment_shipments SET delivery_status = 'delivered',
      delivered_at = confirmed_at,updated_at = confirmed_at WHERE unit_id = p_unit AND external_package_id = 'self-1';
    IF NOT FOUND THEN RAISE EXCEPTION 'Shipment confirmation required before delivery' USING ERRCODE = '22023'; END IF;
    UPDATE public.shop_fulfillment_units SET delivery_status = 'delivered',updated_at = confirmed_at WHERE id = p_unit;
  END IF;
  INSERT INTO public.shop_fulfillment_events(unit_id,deduplication_key,source,event_type,occurred_at,applied_at,details)
    VALUES (p_unit,'self:' || p_status,'admin',p_status,confirmed_at,confirmed_at,jsonb_build_object('actor_id',p_actor));
END;
$$;

REVOKE ALL ON FUNCTION public.shop_adjust_inventory(text,integer,uuid,uuid,text),
  public.shop_reserve_inventory(uuid), public.shop_settle_inventory(uuid,text,text),
  public.shop_confirm_self_shipping(uuid,text,uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_adjust_inventory(text,integer,uuid,uuid,text),
  public.shop_reserve_inventory(uuid), public.shop_settle_inventory(uuid,text,text),
  public.shop_confirm_self_shipping(uuid,text,uuid,text,text,text) TO service_role;
COMMIT;
