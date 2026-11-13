-- Existing permissive proof upload policies also apply to new buckets.
-- Restrict only the new private bucket. The server uses the service role.
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '10s';
CREATE POLICY shop_product_images_server_only ON storage.objects
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (bucket_id <> 'shop-product-images')
  WITH CHECK (bucket_id <> 'shop-product-images');
COMMIT;
