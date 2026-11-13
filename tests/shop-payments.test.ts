import test from 'node:test'
import assert from 'node:assert/strict'
import Stripe from 'stripe'
import { buildTestDraft } from '../app/lib/shop/gelato-draft'
import { NextRequest } from 'next/server'
import { GET as orderStatus } from '../app/api/shop/order/route'
import { orderCookie } from '../app/lib/shop/tokens'
import { parseAddress, parseQuantity, moneyCents } from '../app/lib/shop/validation'
import { signQuote, readQuote, accessToken, tokenHash, validAccess } from '../app/lib/shop/tokens'
import { parseQuote } from '../app/lib/shop/gelato'
import { CALENDAR, checkoutEnabled } from '../app/lib/shop/config'
import { paypalCheckout, reconcilePayPal } from '../app/lib/shop/paypal'
import { markPaid, ShopOrder } from '../app/lib/shop/orders'
import { POST as startCheckout } from '../app/api/shop/checkout/route'
process.env.SHOP_TOKEN_SECRET = 'test-only-secret-with-at-least-32-characters'
process.env.SHOP_PAYMENT_MODE = 'test'
process.env.SHOP_ORIGIN = 'http://localhost:3000'
process.env.PAYPAL_CLIENT_ID = 'fake-client'
process.env.PAYPAL_CLIENT_SECRET = 'fake-secret'
process.env.PAYPAL_MERCHANT_ID = 'TESTMERCHANT'
const address = { firstName: 'Test', lastName: 'Kunde', addressLine1: 'Testweg 1', addressLine2: '', city: 'Berlin', postCode: '10115', country: 'DE', email: 'test@example.com', phone: '' }
const order: ShopOrder = { id: 'f35e7e02-2e37-4a35-bc63-27b517f474ce', access_token_hash: '', provider: 'paypal', mode: 'test', quantity: 2, unit_price_cents: 2990, shipping_cents: 604, total_cents: 6584, currency: 'EUR', address, shipping_method_uid: 'dhl', provider_order_id: 'PAYPALORDER', status: 'pending', file_url: CALENDAR.fileUrl, file_sha256: CALENDAR.fileSha256, product_uid: CALENDAR.productUid, page_count: 14 }
const rawQuote = { quotes: [{ itemReferenceIds: [CALENDAR.id], carrierSurcharge: { price: 0.30, currency: 'EUR' }, shipmentMethods: [{ shipmentMethodUid: 'dhl', name: 'DHL', price: 5.74, currency: 'EUR', isPrivate: true, type: 'normal', minDeliveryDays: 3, maxDeliveryDays: 7 }] }] }
test('addresses, quantity and monetary values reject unsupported or malformed inputs', () => {
  assert.deepEqual(parseAddress(address), address)
  for (const value of [0, -1, 11, 1.5, '2', null]) assert.throws(() => parseQuantity(value))
  assert.throws(() => parseAddress({ ...address, country: 'US' }))
  assert.throws(() => parseAddress({ ...address, email: 'invalid' }))
  assert.throws(() => parseAddress({ ...address, postCode: '8001' }))
  assert.equal(moneyCents('29.90'), 2990)
  for (const price of [-1, null, NaN, Infinity, '1.234', '1e2']) assert.throws(() => moneyCents(price))
})
test('signed quotes bind exact address and price and reject tampering/expiry', () => {
  const data = { id: order.id, expires: Date.now() + 60000, address, quantity: 2, methods: [{ uid: 'dhl', name: 'DHL', shippingCents: 604 }] }
  const token = signQuote(data); assert.deepEqual(readQuote(token), data)
  const changed = Buffer.from(JSON.stringify({ ...data, quantity: 10 })).toString('base64url') + '.' + token.split('.')[1]
  assert.throws(() => readQuote(changed)); assert.throws(() => readQuote(signQuote({ ...data, expires: 0 })))
  const access = accessToken(order.id)
  assert.equal(validAccess(access, tokenHash(access)), true)
  assert.equal(validAccess('a'.repeat(64), tokenHash(access)), false)
})
test('customer shipping excludes Gelato surcharges and procurement tax', () => {
  process.env.GELATO_SHIPPING_COST_TAX_BPS_DE = '1900'
  const method = parseQuote(rawQuote, 'DE')[0]
  assert.equal(method.shippingCents, 574)
  assert.equal(method.carrierCents, 30)
  assert.equal(CALENDAR.unitPriceCents + method.shippingCents, 3564)
  delete process.env.GELATO_SHIPPING_COST_TAX_BPS_DE
  assert.equal(parseQuote(rawQuote, 'DE')[0].shippingCents, 574)
  assert.throws(() => parseQuote({ ...rawQuote, errors: ['error'] }, 'DE'))
  assert.throws(() => parseQuote({ quotes: [...rawQuote.quotes, ...rawQuote.quotes] }, 'DE'))
})
test('live checkout remains closed until explicitly approved', () => {
  process.env.SHOP_CHECKOUT_ENABLED = 'true'; process.env.SHOP_PAYMENT_MODE = 'live'; delete process.env.SHOP_LIVE_APPROVED
  assert.equal(checkoutEnabled(), false)
  process.env.SHOP_PAYMENT_MODE = 'test'; process.env.SHOP_CHECKOUT_ENABLED = 'false'
})
test('disabled checkout cannot call a provider or accept a supplied amount', async () => {
  const response = await startCheckout(new Request('http://localhost:3000/api/shop/checkout', { method: 'POST', body: JSON.stringify({ totalCents: 1, provider: 'stripe' }) }))
  assert.equal(response.status, 503)
})
test('Stripe official signature verifier rejects forged and altered webhook payloads', () => {
  const stripe = new Stripe('sk_test_local_placeholder'), secret = 'whsec_test'
  const payload = JSON.stringify({ id: 'evt_test', object: 'event', type: 'checkout.session.completed', data: { object: {} } })
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret })
  assert.equal(stripe.webhooks.constructEvent(payload, signature, secret).id, 'evt_test')
  assert.throws(() => stripe.webhooks.constructEvent(payload + ' ', signature, secret))
  assert.throws(() => stripe.webhooks.constructEvent(payload, signature, 'wrong'))
})
test('PayPal receives server-side total, shipping, address and stable idempotency key', async () => {
  const original = globalThis.fetch; const requests: { url: string; options?: RequestInit }[] = []
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options })
    return Response.json(String(url).endsWith('/token') ? { access_token: 'mock' } : { id: 'PAYPALORDER', links: [{ rel: 'payer-action', href: 'https://www.sandbox.paypal.com/checkoutnow?token=PAYPALORDER' }] })
  }
  try {
    await paypalCheckout(order)
    const body = JSON.parse(requests[1].options!.body as string)
    assert.equal(body.purchase_units[0].amount.value, '65.84')
    assert.equal(body.purchase_units[0].amount.breakdown.shipping.value, '6.04')
    assert.equal(body.purchase_units[0].payee.merchant_id, 'TESTMERCHANT')
    assert.equal(body.payment_source.paypal.experience_context.shipping_preference, 'SET_PROVIDED_ADDRESS')
    assert.equal((requests[1].options!.headers as Record<string, string>)['PayPal-Request-Id'], `checkout-${order.id}`)
  } finally { globalThis.fetch = original }
})
test('mismatched amount or provider reference cannot persist a payment', async () => {
  await assert.rejects(markPaid(order, 'capture', 1, 'EUR', 'PAYPALORDER'))
  await assert.rejects(markPaid(order, 'capture', 6584, 'USD', 'PAYPALORDER'))
  await assert.rejects(markPaid(order, 'capture', 6584, 'EUR', 'OTHERORDER'))
})
test('PayPal approval alone never marks paid; wrong merchant is rejected', async () => {
  const original = globalThis.fetch
  let status = 'APPROVED'
  globalThis.fetch = async url => Response.json(String(url).endsWith('/token') ? { access_token: 'mock' } : { status, id: 'PAYPALORDER', purchase_units: [{ reference_id: order.id, payee: { merchant_id: 'WRONG' } }] })
  try { await reconcilePayPal(order); status = 'COMPLETED'; await assert.rejects(reconcilePayPal(order)) } finally { globalThis.fetch = original }
})

test('order status reads the original NextRequest cookie and protects paid order access', async () => {
  const original = globalThis.fetch
  const dbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, dbKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  const token = accessToken(order.id)
  globalThis.fetch = async () => Response.json({ ...order, status: 'paid', access_token_hash: tokenHash(token) })
  try {
    const url = `http://localhost:3000/api/shop/order?order=${order.id}`
    const response = await orderStatus(new NextRequest(url, { headers: { cookie: `${orderCookie(order.id)}=${token}` } }))
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.status, 'paid')
    assert.equal(body.address, undefined)
    assert.equal((await orderStatus(new NextRequest(url))).status, 404)
  } finally {
    globalThis.fetch = original
    if (dbUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = dbUrl
    if (dbKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = dbKey
  }
})

test('Gelato draft workflow accepts only paid test orders and exact approved print snapshot', () => {
  const paid = { ...order, status: 'paid' }
  const payload = buildTestDraft(paid)
  assert.equal(payload.orderType, 'draft')
  assert.equal(payload.items[0].quantity, paid.quantity)
  assert.equal(payload.items[0].pageCount, 14)
  assert.equal(payload.items[0].files[0].url, CALENDAR.fileUrl)
  assert.equal(payload.shipmentMethodUid, paid.shipping_method_uid)
  assert.throws(() => buildTestDraft(order))
  assert.throws(() => buildTestDraft({ ...paid, mode: 'live' }))
  assert.throws(() => buildTestDraft({ ...paid, file_sha256: 'different' }))
  assert.throws(() => buildTestDraft({ ...paid, quantity: 0 }))
})

 test('unsigned PayPal webhooks are rejected before any provider request', async () => {
 const {POST}=await import('../app/api/shop/paypal/webhook/route')
 const response=await POST(new Request('https://example.com/api/shop/paypal/webhook',{method:'POST',body:'{}'}))
 assert.equal(response.status,400)
 })
