BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '15s';

CREATE TABLE public.shop_shipping_rates (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]{1,63}$'),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  carrier text NOT NULL CHECK (char_length(btrim(carrier)) BETWEEN 1 AND 120),
  mode text NOT NULL CHECK (mode IN ('self','partner')),
  partner text CHECK (partner ~ '^[a-z][a-z0-9_-]{1,39}$'),
  zone text NOT NULL CHECK (char_length(btrim(zone)) BETWEEN 1 AND 80),
  countries text[] NOT NULL DEFAULT '{}' CHECK (cardinality(countries) <= 249),
  price_cents integer CHECK (price_cents BETWEEN 0 AND 1000000),
  max_length_mm integer CHECK (max_length_mm BETWEEN 1 AND 100000),
  max_width_mm integer CHECK (max_width_mm BETWEEN 1 AND 100000),
  max_depth_mm integer CHECK (max_depth_mm BETWEEN 1 AND 100000),
  max_weight_g integer CHECK (max_weight_g BETWEEN 1 AND 10000000),
  tracking boolean,
  delivery_estimate text CHECK (char_length(delivery_estimate) <= 120),
  valid_through date,
  active boolean NOT NULL DEFAULT false,
  version uuid NOT NULL DEFAULT gen_random_uuid(),
  CHECK ((mode = 'self' AND partner IS NULL) OR (mode = 'partner' AND partner IS NOT NULL AND price_cents IS NULL)),
  CHECK (NOT active OR (cardinality(countries) > 0 AND (mode = 'partner' OR (
    price_cents IS NOT NULL AND max_length_mm IS NOT NULL AND max_width_mm IS NOT NULL
    AND max_depth_mm IS NOT NULL AND max_weight_g IS NOT NULL
  )))),
  -- The first configured Standardbrief must never offer limits above the verified carrier specification.
  CHECK (code <> 'DP-STANDARD-DE' OR (mode = 'self' AND countries = ARRAY['DE']::text[]
    AND max_length_mm <= 235 AND max_width_mm <= 125 AND max_depth_mm <= 5 AND max_weight_g <= 20))
);
ALTER TABLE public.shop_shipping_rates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shop_shipping_rates FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.shop_shipping_rates TO service_role;

ALTER TABLE public.shop_merchandise ADD COLUMN shipping_config jsonb
  CHECK (shipping_config IS NULL OR jsonb_typeof(shipping_config) = 'object');

INSERT INTO public.shop_shipping_rates(code,name,carrier,mode,partner,zone,countries)
VALUES
 ('DP-KOMPAKT-DE','Kompaktbrief','Deutsche Post','self',NULL,'Deutschland',ARRAY['DE']),
 ('DP-GROSS-DE','Großbrief','Deutsche Post','self',NULL,'Deutschland',ARRAY['DE']),
 ('DP-MAXI-DE','Maxibrief','Deutsche Post','self',NULL,'Deutschland',ARRAY['DE']),
 ('DHL-KLEINPAKET','Kleinpaket','DHL','self',NULL,'Deutschland',ARRAY['DE']),
 ('DHL-PAKET','Paket','DHL','self',NULL,'Deutschland',ARRAY['DE']),
 ('GELATO','Externes Fulfillment','Gelato','partner','gelato','Noch zu bestätigen','{}');
INSERT INTO public.shop_shipping_rates(code,name,carrier,mode,zone,countries,price_cents,
  max_length_mm,max_width_mm,max_depth_mm,max_weight_g,valid_through)
VALUES ('DP-STANDARD-DE','Standardbrief','Deutsche Post','self','Deutschland',ARRAY['DE'],95,235,125,5,20,'2026-12-31');

-- Match the reviewed starting state so intervening inventory or editorial changes
-- abort this migration instead of being overwritten.
DO $$
BEGIN
  UPDATE public.shop_merchandise
    SET price_cents = 500, version = gen_random_uuid(),
        shipping_config = '{"rateCodes":["DP-STANDARD-DE"],"domesticOnly":true,"countries":[],"package":null,"standardLetterVerified":false}'::jsonb
    WHERE sku = 'UHL-PATCH-001' AND status = 'draft' AND fulfillment_type = 'self'
      AND stock_on_hand = 98 AND stock_reserved = 0 AND stock_sold = 0
      AND (price_cents IS NULL OR price_cents = 500) AND shipping_config IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Patch differs from the reviewed rollout state'; END IF;
END;
$$;
COMMIT;
