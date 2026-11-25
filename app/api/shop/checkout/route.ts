import { CALENDAR_SKU, getProduct } from '../../../lib/shop/catalog'
import { NextResponse } from 'next/server'
import { assertEnabled, assertSameOrigin, paymentMode, required } from '../../../lib/shop/config'
import { CheckoutError } from '../../../lib/shop/validation'
import { accessToken, readQuote, tokenHash, orderCookie } from '../../../lib/shop/tokens'
import { getOrder, orderDB } from '../../../lib/shop/orders'
import { stripeCheckout } from '../../../lib/shop/stripe'
import { paypalCheckout } from '../../../lib/shop/paypal'
import { errorResponse, jsonBody, rateLimit } from '../../../lib/shop/http'
import { voucherError } from '../../../lib/shop/vouchers'
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
    if (body.acceptedTerms !== true) throw new CheckoutError('Bitte Bestellbedingungen bestätigen.')
    const quote = readQuote(body.token), method = quote.methods.find(m => m.uid === body.shippingMethodUid)
    if (!method) throw new CheckoutError('Bitte Versandart wählen.')
    const product = await getProduct(quote.sku ?? CALENDAR_SKU, quote.address.country)
    if (quote.unitPriceCents !== product.unit_price_cents) throw new CheckoutError('Der Artikelpreis hat sich geändert. Bitte Versand neu berechnen.')
    const discount = quote.discountCents ?? 0
    const total = quote.quantity * product.unit_price_cents + method.shippingCents - discount
    const provider = total === 0 ? 'free' : body.provider
    if (provider === 'stripe') {
      if (quote.voucherCode && total < 50) throw new CheckoutError('Kartenzahlung ist ab 0,50 € möglich. Bitte wähle PayPal.')
      required('STRIPE_WEBHOOK_SECRET')
    }
    else if (provider === 'paypal') required('PAYPAL_WEBHOOK_ID')
    else if (provider !== 'free' || total !== 0 || !quote.voucherCode) throw new CheckoutError('Bitte eine Zahlungsart wählen.')
    const mode = paymentMode(), access = accessToken(quote.id)
    let order = await getOrder(quote.id)
    if (!order) {
      const row = { id: quote.id, access_token_hash: tokenHash(access), provider, mode, sku: product.sku, product_name: product.name, quantity: quote.quantity, unit_price_cents: product.unit_price_cents, shipping_cents: method.shippingCents, total_cents: total, currency: 'EUR', address: quote.address, shipping_method_uid: method.uid, status: 'pending', file_url: product.file_url, file_sha256: product.file_sha256, product_uid: product.gelato_product_uid, page_count: product.page_count }
      if (quote.voucherCode) {
        const { error } = await orderDB().rpc('shop_reserve_voucher_order', {
          p_order: row, p_code: quote.voucherCode, p_expected_discount: discount,
        })
        if (error) voucherError(error)
      } else {
        const { error } = await orderDB().from('shop_orders').insert(row)
        if (error && error.code !== '23505') throw new Error('Order creation failed')
      }
      order = await getOrder(quote.id)
    }
    if (!order) throw new Error('Order missing')
    if (order.provider !== provider || order.mode !== mode || order.shipping_method_uid !== method.uid || order.total_cents !== total || (order.voucher_code ?? undefined) !== quote.voucherCode) throw new CheckoutError('Zahlungs- oder Versandart geändert. Bitte Versand neu berechnen.')
    if (order.provider === 'free' && order.status === 'paid') return checkoutResponse(`/shop/bestellung?order=${order.id}`, order.id, access)
    if (order.status !== 'pending') throw new CheckoutError('Diese Bestellung wurde bereits bearbeitet.')
    if (order.checkout_url) return checkoutResponse(order.checkout_url, order.id, access)
    const checkout = order.provider === 'stripe' ? await stripeCheckout(order) : await paypalCheckout(order)
    const { error, data } = await orderDB().from('shop_orders').update({ provider_order_id: checkout.providerId, checkout_url: checkout.url }).eq('id', order.id).eq('status', 'pending').select('id').maybeSingle()
    if (error || !data) throw new Error('Checkout association failed')
    return checkoutResponse(checkout.url, order.id, access)
  } catch (e) { return errorResponse(e) }
}
