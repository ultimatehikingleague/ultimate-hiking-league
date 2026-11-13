import { CALENDAR_SKU, getProduct } from '../../../lib/shop/catalog'
import { NextResponse } from 'next/server'
import { assertEnabled, assertSameOrigin, paymentMode, required } from '../../../lib/shop/config'
import { CheckoutError } from '../../../lib/shop/validation'
import { accessToken, readQuote, tokenHash, orderCookie } from '../../../lib/shop/tokens'
import { getOrder, orderDB, ShopOrder } from '../../../lib/shop/orders'
import { stripeCheckout } from '../../../lib/shop/stripe'
import { paypalCheckout } from '../../../lib/shop/paypal'
import { errorResponse, jsonBody, rateLimit } from '../../../lib/shop/http'
export const runtime = 'nodejs'
function checkoutResponse(url: string, id: string, access: string) {
  const response = NextResponse.json({ url }, { headers: { 'Cache-Control': 'no-store' } })
  response.cookies.set(orderCookie(id), access, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 172800 })
  return response
}
export async function POST(request: Request) {
  try {
    assertEnabled(); assertSameOrigin(request); await rateLimit(request, 'checkout')
    const body = await jsonBody(request)
    if (!['stripe', 'paypal'].includes(body.provider) || body.acceptedTerms !== true) throw new CheckoutError('Bitte Zahlungsart und Bestellbedingungen bestätigen.')
    // Require webhook setup before accepting money, rather than relying on a browser return URL.
    if (body.provider === 'stripe') required('STRIPE_WEBHOOK_SECRET'); else required('PAYPAL_WEBHOOK_ID')
    const quote = readQuote(body.token), method = quote.methods.find(m => m.uid === body.shippingMethodUid)
    if (!method) throw new CheckoutError('Bitte Versandart wählen.')
    const product = await getProduct(quote.sku ?? CALENDAR_SKU, quote.address.country)
    if (quote.unitPriceCents !== product.unit_price_cents) throw new CheckoutError('Der Artikelpreis hat sich geändert. Bitte Versand neu berechnen.')
    const mode = paymentMode(), access = accessToken(quote.id)
    let order = await getOrder(quote.id)
    if (!order) {
      const row = { id: quote.id, access_token_hash: tokenHash(access), provider: body.provider, mode, sku: product.sku, product_name: product.name, quantity: quote.quantity, unit_price_cents: product.unit_price_cents, shipping_cents: method.shippingCents, total_cents: quote.quantity * product.unit_price_cents + method.shippingCents, currency: 'EUR', address: quote.address, shipping_method_uid: method.uid, status: 'pending', file_url: product.file_url, file_sha256: product.file_sha256, product_uid: product.gelato_product_uid, page_count: product.page_count }
      const { error } = await orderDB().from('shop_orders').insert(row)
      if (error && error.code !== '23505') throw new Error('Order creation failed')
      order = await getOrder(quote.id)
    }
    if (!order) throw new Error('Order missing')
    if (order.provider !== body.provider || order.mode !== mode || order.shipping_method_uid !== method.uid) throw new CheckoutError('Zahlungs- oder Versandart geändert. Bitte Versand neu berechnen.')
    if (order.status !== 'pending') throw new CheckoutError('Diese Bestellung wurde bereits bearbeitet.')
    const saved = order as ShopOrder & { checkout_url?: string }
    if (saved.checkout_url) return checkoutResponse(saved.checkout_url, order.id, access)
    const checkout = order.provider === 'stripe' ? await stripeCheckout(order) : await paypalCheckout(order)
    const { error } = await orderDB().from('shop_orders').update({ provider_order_id: checkout.providerId, checkout_url: checkout.url }).eq('id', order.id).eq('status', 'pending')
    if (error) throw new Error('Checkout association failed')
    return checkoutResponse(checkout.url, order.id, access)
  } catch (e) { return errorResponse(e) }
}
