# ULTIMATE checkout – setup and current limits

Implemented locally on 2026-11-03. Not deployed, no payment or Gelato production order created. All live selling is off by default.

## Architecture
- Single product: calendar-2027, EUR29.90 per copy (1–10), plus address-specific Gelato shipping.
- POST /api/shop/quote validates recipient and calls Gelato orders:quote (never orders). Private EUR shipping methods only; require a single quote, reject partial/errors, charge only the shipment method price to customers. ULTIMATE absorbs production costs, carrier surcharges and procurement taxes.
- Signed offer binds address, quantity, selected shipping amounts and a random checkout ID for15minutes. Browser cannot set prices, currency, file URL or productUid.
- POST /api/shop/checkout records an immutable order snapshot; retries reuse the same order/provider idempotency key. Changing method/provider requires a fresh quote.
- Stripe hosted Checkout (card) or PayPal Orders API approval redirect. No merchant card details collected. Only server-side secrets.
- Signed provider webhooks /api/shop/stripe/webhook and /api/shop/paypal/webhook verify settled payments against local amount, currency, provider ID, mode and merchant. PayPal CHECKOUT.ORDER.APPROVED is captured server-side, including if the browser never returns.
- Atomic shop_record_payment RPC prevents repeated payment events from marking/processing an order twice. Order-access tokens are HttpOnly cookies, never URL parameters. Rate limits use hashed IPs, not raw IP storage.
- A paid order is only recorded; automatic Gelato production is intentionally absent until the print workflow is approved.

## Database
Apply supabase/migrations/20261103_shop_payments.sql through the existing Supabase migration workflow. It creates only shop_orders, shop_payments, shop_request_limits and two service-role-only functions. RLS denies browser access. Read-only remote check on 2026-11-03 returned HTTP 404 for shop_orders: the table is not available yet. This migration has NOT been applied or integration-tested against PostgreSQL yet. No changes to pre-existing tables.

## Environment (server only; do not send secrets in chat)
```
SHOP_CHECKOUT_ENABLED=false
SHOP_LIVE_APPROVED=false
SHOP_PAYMENT_MODE=test
SHOP_ORIGIN=http://localhost:3000
SHOP_TOKEN_SECRET=<random secret, at least32characters>
STRIPE_SECRET_KEY=<sk_test_...>
STRIPE_WEBHOOK_SECRET=<whsec_...>
PAYPAL_CLIENT_ID=<sandbox merchant app client ID>
PAYPAL_CLIENT_SECRET=<sandbox app secret>
PAYPAL_MERCHANT_ID=<sandbox seller merchant ID>
PAYPAL_WEBHOOK_ID=<sandbox app webhook ID>
```
Existing GELATO_API_KEY, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are also needed. These are NOT printed by tests. Enable checkout only in a test/preview environment after configuring and migrating. Production origin is https://www.ultimatehikingleague.com. Do not set SHOP_LIVE_APPROVED=true before launch review.

Customer pricing approved: EUR 29.90 per calendar plus quoted shipping method price only. No surcharge or procurement-tax gross-up. All other Gelato costs are borne by ULTIMATE. Legacy tax-factor variables have no effect. No automatic customer VAT calculation enabled.

Stripe SDK23.1 uses current allowed_payment_method_types; official SDK validates webhook signatures. Subscribe to checkout.session.completed and checkout.session.async_payment_succeeded. PayPal app type Merchant (not Platform); subscribe to CHECKOUT.ORDER.APPROVED and PAYMENT.CAPTURE.COMPLETED. Test and live credentials/webhook IDs must be separated.

## Before live launch
1. Store test credentials securely locally/Vercel preview, apply migration, configure test webhook URLs and confirmed Gelato cost calculation.
2. Exercise Stripe success/decline/cancel, PayPal approve/capture/cancel, tab-closed recovery, duplicate callbacks, DB outage recovery, amount/currency mismatch, and multi-tab order access. Verify persisted amounts.
3. Verify corrected calendar via Gelato draft/print preview; PDF/X independently not validated yet. Print file and hash are frozen in app/lib/shop/config.ts. Do not substitute older PDFs.
4. Complete merchant legal pages, withdrawal and delivery information and review data-processing disclosures for Gelato/Stripe/PayPal. Checkout currently requires an address/total check only; it is not a substitute for the required pre-contract consumer information.
5. Implement one central invoice/confirmation workflow for all methods (sequential invoice numbers, seller identity, §19 notice, corrections/refunds). Stripe invoice_creation remains disabled to avoid duplicate invoices. No invoice emails are sent yet.
6. Bank transfer remains unimplemented pending account details/permission and manual-payment reconciliation. PayPal bank verification still pending per handover.
7. Configure live credentials separately, run controlled approved tests, deploy and explicitly enable launch only after above checks.

## Verified now
node --import tsx --test tests/shop-payments.test.ts (9 offline tests); npx tsc --noEmit; scoped ESLint. Tests do not replace sandbox provider or PostgreSQL tests. Live quote examples saved in separate workspace output/pdf/gelato-shipping-quotes-dach.json, not fixed end-customer rates.

## Local credential entry
Run `python3 scripts/setup-shop-test.py` from the project terminal. Inputs are hidden and written only to ignored .env.local (mode 0600), never to chat. Empty inputs preserve existing values. It does not enable live selling. A local SHOP_TOKEN_SECRET was generated securely on 2026-11-03; SHOP_PAYMENT_MODE=test and SHOP_LIVE_APPROVED=false were set. Provider credentials remain missing.

Next manual step: open the existing Supabase project SQL editor and run supabase/migrations/20261103_shop_payments.sql once. Then verify the three tables and service-only RPC functions before entering provider sandbox credentials. No existing tables are altered.

## Stripe sandbox verification 2026-11-04
User completed hosted Stripe test checkout. Independently verified Stripe payment_status=paid, livemode=false, amount_total=3564 EUR cents and matching Supabase order status=paid (2990 + 574 shipping). Return page showed a temporary error; direct authenticated status-handler replay returned HTTP 200 paid, so exact original failure is not established. Status UI now retries transient failures and always warns against paying again. No Gelato production order created. All three shop tables were verified reachable after the user applied the migration.

## PayPal sandbox verification 2026-11-04
User completed PayPal sandbox checkout; return UI progressed from pending to payment confirmed. Independent read-only verification: shop order paid/test/paypal; total 3564 cents (2990 + 574 shipping); exactly one matching payment record; PayPal order COMPLETED and capture COMPLETED. No live payment or Gelato production order. Temporary Cloudflare relay exposes only signed POST /api/shop/paypal/webhook and must stay running during local callback tests; production requires permanent webhook URL.

## Gelato controlled draft verification 2026-11-04
Created draft 19f523b0-1bba-4271-8881-52dff6e42cd5 from paid PayPal test order 802ad9bf-213c-444b-984a-8df44048be5e. Reference ultimate-test-802ad9bf-213c-444b-984a-8df44048be5e. GET confirmed draft/draft/draft, approved product UID, quantity 1, DHL Parcel. Gelato copies file to its own S3 URL: downloaded that copy and verified SHA256 matches approved PDF exactly, 50,674,173 bytes. Three preview URLs exist; API returns pageCount=null and processedFileUrl empty. This does NOT establish print preview/page arrangement approval; visual review in Gelato remains required before production. No paid/production order created.
New controlled script: node --import tsx scripts/gelato-test-draft.ts ORDER_UUID --create-draft. It only accepts paid TEST orders with exact approved print snapshot. Separate from payment callbacks; no automatic production. Private local receipts/locks in .shop-private/gelato (gitignored). Ambiguous failures retain lock; inspect remote search before any manual retry. Local lock is not a distributed production fulfillment queue. Eleven offline payment/draft tests pass; tsc and scoped lint pass.

## Product previews updated 2026-11-04
Replaced all 13 old template JPEGs with WebP renderings of approved PDF pages 1–13 (cover + January–December). Rendered at 150 dpi, cropped only the 4 mm bleed to A3 trim. Blank page 14 excluded. Shop card, product gallery, catalog and checkout cover point to versioned final filenames. Source hash recorded in public preview-manifest.json; reproducible export script scripts/export-calendar-previews.py. Contact sheet visually reviewed, TypeScript passes. Local changes only, not deployed.

## Gelato preview reviewed by owner 2026-11-04
Owner confirmed individual calendar sheets look good and are in the correct order in the Gelato draft preview. Screenshots show cover through December followed by the intended blank final page. Approval concerns visual preview and page order only, not a paid production order or live selling. Draft 19f523b0-1bba-4271-8881-52dff6e42cd5 remains unsubmitted for production. Next: durable fulfillment workflow with separate test/live handling, duplicate prevention and retry/reconciliation; confirmation/invoices; permanent provider webhooks and deployment before live launch.

## Durable draft automation prepared 2026-11-04
Migration 20261104_shop_fulfillment.sql is NOT applied yet. A transactional AFTER paid transition queues each order once. Test-only claim function uses SKIP LOCKED and unique claim token; stale processing moves to review instead of blindly recreating an order. Worker scripts/process-gelato-drafts.ts (--watch optional) only creates test drafts, searches/reuses matching reference, and records Gelato ID or review status. No automatic live production; no backfill of old paid tests to avoid duplicating the already reviewed draft. 13 offline tests pass. Database integration and live worker verification await migration. Legal/returns owner preferences and remaining launch work recorded in docs/shop-launch-legal.md.

## Automatic draft handoff verified 2026-11-04
After owner applied fulfillment migration and started watch worker, new Stripe test order 679336c9-4157-489f-b5f2-1e8523500b02 was paid for 3564 cents (shipping 574). Read-only verification: queue status draft, attempts=1, last_error=null; Gelato ID 77d833b6-d456-48fe-bd63-c0647efde898. Gelato reference search returns exactly one matching draft with financialStatus=draft and fulfillmentStatus=draft. Thus payment -> transactional queue -> local worker -> Gelato draft verified end to end. Live production, hosted worker, permanent webhook setup and confirmations/invoices remain outstanding.
