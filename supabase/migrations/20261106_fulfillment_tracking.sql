-- Auftrag 3: freigegebenes additives Kernschema. Produktive Ausführung separat.
-- Additiv; keine bestehenden Tabellen/Trigger/RPCs oder Datensätze verändern.
-- Absichtlich kein IF NOT EXISTS: Namenskonflikte müssen vorab geprüft werden.
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '15s';

CREATE TABLE public.shop_fulfillment_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.shop_orders(id),
  mode text NOT NULL CHECK (mode IN ('test','live')),
  provider text NOT NULL CHECK (provider ~ '^[a-z][a-z0-9_-]*$'),
  provider_account text NOT NULL DEFAULT 'default',
  external_order_id text,
  external_reference text,
  raw_status text,
  production_status text NOT NULL DEFAULT 'unknown'
    CHECK (production_status IN ('unknown','not_started','in_production','printed','failed','canceled','on_hold')),
  shipping_status text NOT NULL DEFAULT 'unknown'
    CHECK (shipping_status IN ('unknown','ready','shipped','in_transit','returned')),
  delivery_status text NOT NULL DEFAULT 'unknown'
    CHECK (delivery_status IN ('unknown','delivered','returned')),
  source_updated_at timestamptz,
  last_success_at timestamptz,
  review_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,order_id),
  UNIQUE (provider,provider_account,mode,external_order_id)
);
CREATE FUNCTION public.shop_tracking_validate_unit() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.shop_orders o
      WHERE o.id = NEW.order_id AND o.mode = NEW.mode) THEN
    RAISE EXCEPTION 'Fulfillment mode does not match order';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER shop_tracking_validate_unit BEFORE INSERT OR UPDATE
ON public.shop_fulfillment_units FOR EACH ROW
EXECUTE FUNCTION public.shop_tracking_validate_unit();
-- Keine unbewiesenen Versand-/Zustellzeiten aus dem Gesamtstatus ableiten.
CREATE INDEX ON public.shop_fulfillment_units(order_id);

CREATE TABLE public.shop_fulfillment_unit_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL,
  order_id uuid NOT NULL REFERENCES public.shop_orders(id),
  order_line_id uuid NOT NULL REFERENCES public.shop_order_lines(id),
  external_item_id text,
  external_item_reference text,
  quantity integer NOT NULL CHECK (quantity > 0),
  raw_status text,
  UNIQUE (id,unit_id),
  UNIQUE (unit_id,order_line_id),
  UNIQUE (unit_id,external_item_id),
  FOREIGN KEY (unit_id,order_id) REFERENCES public.shop_fulfillment_units(id,order_id)
);
-- Bestehende Tabelle erhält keinen neuen Composite-Index: Zuordnung per Trigger prüfen.
CREATE FUNCTION public.shop_tracking_validate_line() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.shop_order_lines l
      WHERE l.id = NEW.order_line_id AND l.order_id = NEW.order_id) THEN
    RAISE EXCEPTION 'Fulfillment line belongs to another order';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER shop_tracking_validate_line BEFORE INSERT OR UPDATE
ON public.shop_fulfillment_unit_lines FOR EACH ROW
EXECUTE FUNCTION public.shop_tracking_validate_line();

CREATE TABLE public.shop_fulfillment_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.shop_fulfillment_units(id),
  external_shipment_id text,
  external_package_id text,
  raw_status text,
  shipping_status text NOT NULL DEFAULT 'unknown'
    CHECK (shipping_status IN ('unknown','ready','shipped','in_transit','returned')),
  delivery_status text NOT NULL DEFAULT 'unknown'
    CHECK (delivery_status IN ('unknown','delivered','returned')),
  shipping_method_name text,
  carrier text,
  tracking_number text,
  tracking_url text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  timestamp_source text,
  first_observed_shipped_at timestamptz,
  first_observed_delivered_at timestamptz,
  last_success_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,unit_id),
  UNIQUE (unit_id,external_package_id),
  CHECK ((shipped_at IS NULL AND delivered_at IS NULL) OR timestamp_source IS NOT NULL)
);
CREATE INDEX ON public.shop_fulfillment_shipments(unit_id);
CREATE TABLE public.shop_fulfillment_shipment_lines (
  shipment_id uuid NOT NULL,
  unit_line_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  quantity integer CHECK (quantity > 0), -- NULL = unbekannt, niemals schätzen
  PRIMARY KEY (shipment_id,unit_line_id),
  FOREIGN KEY (shipment_id,unit_id) REFERENCES public.shop_fulfillment_shipments(id,unit_id),
  FOREIGN KEY (unit_line_id,unit_id) REFERENCES public.shop_fulfillment_unit_lines(id,unit_id)
);

CREATE TABLE public.shop_fulfillment_sync (
  unit_id uuid PRIMARY KEY REFERENCES public.shop_fulfillment_units(id),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','processing','idle','review')),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  claim_token uuid,
  lease_until timestamptz,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error_code text,
  last_error text,
  CHECK ((state = 'processing' AND claim_token IS NOT NULL AND lease_until IS NOT NULL)
      OR (state <> 'processing' AND claim_token IS NULL AND lease_until IS NULL))
);
CREATE INDEX ON public.shop_fulfillment_sync(next_attempt_at) WHERE state = 'pending';
CREATE INDEX ON public.shop_fulfillment_sync(lease_until) WHERE state = 'processing';

CREATE TABLE public.shop_tracking_discovery (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  after_order uuid,
  next_scan_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.shop_tracking_discovery DEFAULT VALUES;


CREATE TABLE public.shop_fulfillment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.shop_fulfillment_units(id),
  deduplication_key text NOT NULL,
  source text NOT NULL CHECK (source IN ('poll','webhook','admin')),
  event_type text NOT NULL,
  provider_event_id text,
  occurred_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  error_code text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  UNIQUE (unit_id,deduplication_key)
);
-- details nur minimierte technische Allowlist; keine Adressen, Schlüssel, Rechnungen,
-- Druckdatei-URLs oder vollständigen Gelato-Antworten speichern.
CREATE INDEX ON public.shop_fulfillment_events(unit_id,received_at DESC);

-- Ausschließlich neue Tabellen absichern. Keine Browser-/authenticated-Rechte.
DO $$
DECLARE relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'shop_fulfillment_units','shop_fulfillment_unit_lines',
    'shop_fulfillment_shipments','shop_fulfillment_shipment_lines',
    'shop_fulfillment_sync','shop_fulfillment_events','shop_tracking_discovery'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', relation_name);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', relation_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO service_role', relation_name);
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.shop_tracking_validate_unit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_tracking_validate_line() FROM PUBLIC, anon, authenticated;

-- Discovery reads at most 64 legacy primary keys per pass. A completed pass
-- starts again after one hour so transfers committed behind the cursor are found.
CREATE FUNCTION public.shop_tracking_seed(p_order_id uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE cursor_id uuid; ids uuid[];
BEGIN
 IF p_order_id IS NOT NULL THEN
  ids:=ARRAY[p_order_id];
 ELSE
  SELECT after_order INTO cursor_id FROM public.shop_tracking_discovery
  WHERE singleton AND next_scan_at<=now() FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT array_agg(page.order_id ORDER BY page.order_id) INTO ids
  FROM (
   SELECT order_id FROM public.shop_fulfillment
   WHERE order_id>coalesce(cursor_id,'00000000-0000-0000-0000-000000000000'::uuid)
   ORDER BY order_id LIMIT 64
  ) page;
  UPDATE public.shop_tracking_discovery SET
   after_order=CASE WHEN cardinality(ids)=64 THEN ids[64] ELSE NULL END,
   next_scan_at=now()+CASE WHEN cardinality(ids)=64 THEN interval '15 minutes' ELSE interval '1 hour' END
  WHERE singleton;
 END IF;

 WITH seeded AS (
  INSERT INTO public.shop_fulfillment_units(order_id,mode,provider,external_order_id,external_reference)
  SELECT o.id,o.mode,'gelato',f.gelato_order_id,'ultimate-'||o.mode||'-'||o.id::text
  FROM public.shop_fulfillment f JOIN public.shop_orders o ON o.id=f.order_id
  WHERE f.order_id=ANY(ids) AND f.gelato_order_id IS NOT NULL
  AND f.mode='live' AND o.mode='live' AND f.status='submitted'
  ON CONFLICT(provider,provider_account,mode,external_order_id) DO NOTHING
  RETURNING id
 )
 INSERT INTO public.shop_fulfillment_sync(unit_id) SELECT id FROM seeded;
END;
$$;

CREATE FUNCTION public.shop_tracking_claim(p_order_id uuid DEFAULT NULL) RETURNS SETOF public.shop_fulfillment_sync
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF p_order_id IS NULL THEN PERFORM public.shop_tracking_seed(); END IF;
 RETURN QUERY
 UPDATE public.shop_fulfillment_sync SET state='processing',claim_token=gen_random_uuid(),
 lease_until=now()+interval '2 minutes',last_attempt_at=now(),attempts=attempts+1
 WHERE unit_id=(SELECT s.unit_id FROM public.shop_fulfillment_sync s
 JOIN public.shop_fulfillment_units u ON u.id=s.unit_id
 WHERE u.provider='gelato' AND u.mode='live' AND (p_order_id IS NULL OR u.order_id=p_order_id)
 AND ((s.state='pending' AND s.next_attempt_at<=now())
 OR (s.state='processing' AND s.lease_until<now()))
 ORDER BY s.next_attempt_at FOR UPDATE OF s SKIP LOCKED LIMIT 1)
 RETURNING *;
END;
$$;
CREATE FUNCTION public.shop_tracking_refresh(p_order_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE changed integer;
BEGIN
 PERFORM public.shop_tracking_seed(p_order_id);
 UPDATE public.shop_fulfillment_sync s SET state='pending',next_attempt_at=now(),claim_token=NULL,lease_until=NULL
 FROM public.shop_fulfillment_units u WHERE u.id=s.unit_id AND u.order_id=p_order_id
 AND u.provider='gelato' AND u.mode='live' AND s.state<>'processing'
 AND (s.last_attempt_at IS NULL OR s.last_attempt_at<now()-interval '60 seconds');
 GET DIAGNOSTICS changed=ROW_COUNT;
 RETURN changed>0;
END;
$$;
CREATE FUNCTION public.shop_tracking_apply(p_unit_id uuid,p_token uuid,p_snapshot jsonb,p_hash text,p_error text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u public.shop_fulfillment_units; item jsonb; parcel jsonb; line_id uuid;
 shipment_id uuid; unit_line uuid; failures integer; review text; elapsed timestamptz:=now();
BEGIN
 PERFORM 1 FROM public.shop_fulfillment_sync WHERE unit_id=p_unit_id AND claim_token=p_token
 AND state='processing' AND lease_until>now() FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO STRICT u FROM public.shop_fulfillment_units WHERE id=p_unit_id FOR UPDATE;
 SELECT attempts INTO failures FROM public.shop_fulfillment_sync WHERE unit_id=p_unit_id;
 IF p_error IS NOT NULL THEN
 UPDATE public.shop_fulfillment_sync SET state=CASE WHEN failures>=8 OR p_error='GELATO_REFERENCE_MISMATCH' THEN 'review' ELSE 'pending' END,
 claim_token=NULL,lease_until=NULL,last_error_code=left(p_error,80),last_error='Statusabruf fehlgeschlagen; letzter bekannter Stand bleibt erhalten.',
 next_attempt_at=now()+make_interval(secs=>least(3600,60*power(2,least(failures,6))::integer)) WHERE unit_id=p_unit_id;
 INSERT INTO public.shop_fulfillment_events(unit_id,deduplication_key,source,event_type,error_code)
 VALUES(p_unit_id,p_token::text,'poll','sync_failed',left(p_error,80)) ON CONFLICT DO NOTHING;
 RETURN true;
 END IF;
 UPDATE public.shop_fulfillment_units SET raw_status=p_snapshot->>'raw_status',production_status=p_snapshot->>'production_status',
 shipping_status=p_snapshot->>'shipping_status',delivery_status=p_snapshot->>'delivery_status',last_success_at=elapsed,updated_at=elapsed
 WHERE id=p_unit_id;
 FOR item IN SELECT * FROM jsonb_array_elements(p_snapshot->'items') LOOP
 -- Only current unambiguous single-item orders are automatically mapped.
 SELECT l.id INTO line_id FROM public.shop_order_lines l JOIN public.shop_orders o ON o.id=l.order_id
 WHERE l.order_id=u.order_id AND o.product_uid=item->>'product_uid' AND l.quantity=(item->>'quantity')::integer
 AND (SELECT count(*) FROM public.shop_order_lines WHERE order_id=u.order_id)=1
 AND jsonb_array_length(p_snapshot->'items')=1
 AND NOT EXISTS(SELECT 1 FROM public.shop_fulfillment_unit_lines other WHERE other.order_line_id=l.id AND other.unit_id<>u.id);
 IF line_id IS NOT NULL THEN
 INSERT INTO public.shop_fulfillment_unit_lines(unit_id,order_id,order_line_id,external_item_id,quantity,raw_status)
 VALUES(u.id,u.order_id,line_id,item->>'id',(item->>'quantity')::integer,item->>'raw_status')
 ON CONFLICT(unit_id,order_line_id) DO UPDATE SET raw_status=excluded.raw_status;
 ELSE review:='Artikelzuordnung nicht eindeutig; manuelle Prüfung erforderlich.'; END IF;
 END LOOP;
 FOR parcel IN SELECT * FROM jsonb_array_elements(p_snapshot->'packages') LOOP
 INSERT INTO public.shop_fulfillment_shipments(unit_id,external_package_id,external_shipment_id,shipping_method_name,tracking_number,tracking_url,last_success_at)
 VALUES(u.id,parcel->>'id',parcel->>'shipment_id',parcel->>'shipping_method_name',parcel->>'tracking_number',parcel->>'tracking_url',elapsed)
 ON CONFLICT(unit_id,external_package_id) DO UPDATE SET shipping_method_name=excluded.shipping_method_name,
 tracking_number=excluded.tracking_number,tracking_url=excluded.tracking_url,last_success_at=elapsed,updated_at=elapsed
 RETURNING id INTO shipment_id;
 FOR unit_line IN SELECT l.id FROM public.shop_fulfillment_unit_lines l WHERE l.unit_id=u.id
 AND l.external_item_id IN (SELECT jsonb_array_elements_text(parcel->'item_ids')) LOOP
 INSERT INTO public.shop_fulfillment_shipment_lines(shipment_id,unit_line_id,unit_id)
 VALUES(shipment_id,unit_line,u.id) ON CONFLICT DO NOTHING;
 END LOOP;
 END LOOP;
 UPDATE public.shop_fulfillment_units SET review_reason=review WHERE id=u.id;
 INSERT INTO public.shop_fulfillment_events(unit_id,deduplication_key,source,event_type,applied_at,details)
 VALUES(u.id,p_hash,'poll','status_snapshot',elapsed,jsonb_build_object('raw_status',p_snapshot->>'raw_status')) ON CONFLICT DO NOTHING;
 UPDATE public.shop_fulfillment_sync SET
 state=CASE WHEN p_snapshot->>'raw_status' IN ('delivered','canceled','returned') THEN 'idle'
            WHEN p_snapshot->>'raw_status' IN ('failed','on_hold','not_connected') THEN 'review'
            ELSE 'pending' END,
 claim_token=NULL,lease_until=NULL,attempts=0,
 last_success_at=elapsed,last_error=NULL,last_error_code=NULL,
 next_attempt_at=elapsed+CASE WHEN p_snapshot->>'raw_status' IN ('shipped','in_transit') THEN interval '6 hours' ELSE interval '15 minutes' END
 WHERE unit_id=u.id;
 RETURN true;
END;
$$;
CREATE FUNCTION public.shop_tracking_link(p_unit_id uuid,p_token uuid,p_external_id text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u public.shop_fulfillment_units;
BEGIN
 SELECT * INTO STRICT u FROM public.shop_fulfillment_units WHERE id=p_unit_id;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u.order_id::text,0));
 IF NOT EXISTS(SELECT 1 FROM public.shop_fulfillment_sync WHERE unit_id=u.id
 AND claim_token=p_token AND state='processing' AND lease_until>now()) THEN
 RAISE EXCEPTION 'Stale status lease'; END IF;
 IF EXISTS(SELECT 1 FROM public.shop_fulfillment_units WHERE provider=u.provider
 AND provider_account=u.provider_account AND mode=u.mode AND external_order_id=p_external_id AND order_id<>u.order_id) THEN
 RAISE EXCEPTION 'Connected order belongs to another order'; END IF;
 IF (SELECT count(*) FROM public.shop_fulfillment_units WHERE order_id=u.order_id)>=20
 AND NOT EXISTS(SELECT 1 FROM public.shop_fulfillment_units WHERE order_id=u.order_id AND external_order_id=p_external_id) THEN
 RAISE EXCEPTION 'Connected order limit exceeded'; END IF;
 WITH linked AS (
  INSERT INTO public.shop_fulfillment_units(order_id,mode,provider,provider_account,external_order_id,external_reference)
  VALUES(u.order_id,u.mode,u.provider,u.provider_account,p_external_id,u.external_reference)
  ON CONFLICT(provider,provider_account,mode,external_order_id) DO NOTHING
  RETURNING id
 )
 INSERT INTO public.shop_fulfillment_sync(unit_id) SELECT id FROM linked;
END;
$$;
REVOKE ALL ON FUNCTION public.shop_tracking_link(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shop_tracking_link(uuid,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.shop_tracking_seed(uuid),public.shop_tracking_claim(uuid),public.shop_tracking_refresh(uuid),public.shop_tracking_apply(uuid,uuid,jsonb,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shop_tracking_seed(uuid),public.shop_tracking_claim(uuid),public.shop_tracking_refresh(uuid),public.shop_tracking_apply(uuid,uuid,jsonb,text,text) TO service_role;
COMMIT;
