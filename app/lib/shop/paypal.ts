import { CALENDAR, paymentMode, required, shopOrigin } from './config'
import { CheckoutError, formatMoney, moneyCents } from './validation'
import { markPaid, ShopOrder } from './orders'
export async function paypalRequest(path: string, method = 'GET', body?: unknown, requestId?: string) {
  const base = paymentMode() === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
  const auth = await fetch(base + '/v1/oauth2/token', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(required('PAYPAL_CLIENT_ID') + ':' + required('PAYPAL_CLIENT_SECRET')).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials', cache: 'no-store', signal: AbortSignal.timeout(20000) })
  if (!auth.ok) throw new CheckoutError('PayPal ist gerade nicht verfügbar.', 502)
  const token = await auth.json()
  const result = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json', ...(requestId ? { 'PayPal-Request-Id': requestId } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(25000) })
  if (!result.ok) throw new CheckoutError('PayPal konnte die Zahlung nicht bearbeiten. Bitte erneut versuchen.', 502)
  return result.json()
}
export async function paypalCheckout(order: ShopOrder) {
  const a = order.address, origin = shopOrigin()
  const result = await paypalRequest('/v2/checkout/orders', 'POST', { intent: 'CAPTURE', purchase_units: [{ reference_id: order.id, custom_id: order.id,
    payee: { merchant_id: required('PAYPAL_MERCHANT_ID') },
    amount: { currency_code: 'EUR', value: formatMoney(order.total_cents), breakdown: { item_total: { currency_code: 'EUR', value: formatMoney(order.quantity * order.unit_price_cents) }, shipping: { currency_code: 'EUR', value: formatMoney(order.shipping_cents) } } },
    items: [{ name: order.product_name ?? CALENDAR.name, quantity: String(order.quantity), unit_amount: { currency_code: 'EUR', value: formatMoney(order.unit_price_cents) }, category: 'PHYSICAL_GOODS' }],
    shipping: { name: { full_name: a.firstName + ' ' + a.lastName }, address: { address_line_1: a.addressLine1, address_line_2: a.addressLine2 || undefined, admin_area_2: a.city, postal_code: a.postCode, country_code: a.country } },
  }], payment_source: { paypal: { experience_context: { brand_name: 'ULTIMATE OUTDOOR STORE', shipping_preference: 'SET_PROVIDED_ADDRESS', user_action: 'PAY_NOW', return_url: `${origin}/shop/bestellung?order=${order.id}&paypal=1`, cancel_url: `${origin}/shop/checkout?cancelled=1` } } } }, `checkout-${order.id}`)
  const link = result.links?.find((l: { rel: string; href: string }) => ['payer-action', 'approve'].includes(l.rel))
  if (!result.id || !link || !/^https:\/\/([a-z0-9-]+\.)*paypal\.com\//i.test(link.href)) throw new Error('PayPal approval URL missing')
  return { providerId: result.id as string, url: link.href as string }
}
export async function reconcilePayPal(order: ShopOrder, capture = false) {
  if (!order.provider_order_id || order.provider !== 'paypal' || order.mode !== paymentMode()) throw new Error('PayPal order mismatch')
  // GET first makes recovery safe after a capture succeeded but the database was temporarily unavailable.
  let result = await paypalRequest('/v2/checkout/orders/' + encodeURIComponent(order.provider_order_id))
  if (capture && result.status === 'APPROVED') result = await paypalRequest('/v2/checkout/orders/' + encodeURIComponent(order.provider_order_id) + '/capture', 'POST', {}, `capture-${order.id}`)
  if (result.status !== 'COMPLETED') return
  const units = result.purchase_units
  if (!Array.isArray(units) || units.length !== 1 || units[0].reference_id !== order.id || units[0].payee?.merchant_id !== required('PAYPAL_MERCHANT_ID')) throw new Error('PayPal merchant/order mismatch')
  const captures = units[0].payments?.captures
  if (!Array.isArray(captures) || captures.length !== 1 || captures[0].status !== 'COMPLETED' || typeof captures[0].id !== 'string') throw new Error('PayPal capture incomplete')
  await markPaid(order, captures[0].id, moneyCents(captures[0].amount.value), captures[0].amount.currency_code, result.id)
}
