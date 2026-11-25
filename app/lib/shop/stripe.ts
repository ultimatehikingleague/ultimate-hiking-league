import Stripe from 'stripe'
import { CALENDAR, paymentMode, required, shopOrigin } from './config'
import { CheckoutError } from './validation'
import { getOrder, markPaid, ShopOrder } from './orders'
import { releaseVoucherOrder } from './vouchers'

export function stripeClient() {
  const key = required('STRIPE_SECRET_KEY'), mode = paymentMode()
  if (!(mode === 'live' ? /^(sk|rk)_live_/ : /^(sk|rk)_test_/).test(key)) throw new CheckoutError('Stripe-Zahlungsmodus stimmt nicht überein.', 503)
  return new Stripe(key, { maxNetworkRetries: 2, timeout: 20000 })
}
export async function stripeCheckout(order: ShopOrder) {
  const origin = shopOrigin()
  const merchandise = order.quantity * order.unit_price_cents - (order.discount_cents ?? 0)
  const unit = Math.floor(merchandise / order.quantity)
  const remainder = merchandise % order.quantity
  const lineItems = [[unit, order.quantity - remainder], [unit + 1, remainder]]
    .filter(([, quantity]) => quantity > 0)
    .map(([unit_amount, quantity]) => ({
      price_data: { currency: 'eur', unit_amount, product_data: { name: order.product_name ?? CALENDAR.name } },
      quantity,
    }))
  if (order.voucher_code && order.shipping_cents > 0) lineItems.push({
    price_data: { currency: 'eur', unit_amount: order.shipping_cents, product_data: { name: 'Versand' } },
    quantity: 1,
  })
  const session = await stripeClient().checkout.sessions.create({ mode: 'payment', allowed_payment_method_types: ['card'], locale: 'de',
    customer_email: order.address.email, client_reference_id: order.id, metadata: { orderId: order.id },
    line_items: lineItems,
    ...(!order.voucher_code ? { shipping_options: [{ shipping_rate_data: { type: 'fixed_amount', fixed_amount: { amount: order.shipping_cents, currency: 'eur' }, display_name: 'Versand' } }] } : {}),
    automatic_tax: { enabled: false },
    custom_text: { submit: { message: 'Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.' } },
    success_url: `${origin}/shop/bestellung?order=${order.id}`,
    cancel_url: `${origin}/shop/checkout?cancelled=1`,
    expires_at: order.voucher_expires_at ? Math.floor(Date.parse(order.voucher_expires_at) / 1000) : Math.floor(new Date(order.created_at!).getTime() / 1000) + 1800,
  }, { idempotencyKey: `checkout-${order.id}` })
  if (!session.url) throw new Error('Stripe checkout URL missing')
  return { providerId: session.id, url: session.url }
}
export async function reconcileStripe(sessionId: string) {
  const session = await stripeClient().checkout.sessions.retrieve(sessionId)
  if (session.payment_status !== 'paid' && session.status !== 'expired') return
  const order = session.client_reference_id ? await getOrder(session.client_reference_id) : null
  if (!order || order.provider !== 'stripe' || session.livemode !== (order.mode === 'live') || session.metadata?.orderId !== order.id) throw new Error('Stripe payment mismatch')
  // A webhook can race the create-session response. Persist its immutable association first.
  if (!order.provider_order_id) throw new Error('Checkout association pending; webhook must retry')
  if (order.provider_order_id !== session.id) throw new Error('Stripe payment mismatch')
  if (session.payment_status !== 'paid') {
    if (order.voucher_code) await releaseVoucherOrder(order.id, true)
    return
  }
  if (typeof session.payment_intent !== 'string') throw new Error('Stripe payment missing')
  await markPaid(order, session.payment_intent, session.amount_total ?? -1, session.currency ?? '', session.id)
}
