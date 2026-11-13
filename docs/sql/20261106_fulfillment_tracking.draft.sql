-- REVIEW ONLY: Auftrag 3 / 2026-11-06. Nicht automatisch anwenden.
-- Additiv; keine bestehenden Tabellen/Trigger/RPCs oder Datensätze verändern.
-- Absichtlich kein IF NOT EXISTS: Namenskonflikte müssen vorab geprüft werden.
BEGIN;

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
    'shop_fulfillment_sync','shop_fulfillment_events'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', relation_name);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', relation_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO service_role', relation_name);
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.shop_tracking_validate_unit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_tracking_validate_line() FROM PUBLIC, anon, authenticated;
COMMIT;
-- Noch KEIN Backfill, Cronjob, Webhook, Bestands-/Erstattungsjournal oder Schreib-RPC.
-- Claim/Apply-RPCs, Mengenprüfung über mehrere Einheiten und Mode-Abgleich werden
-- vor produktiver Synchronisation separat geprüft und atomar implementiert.
