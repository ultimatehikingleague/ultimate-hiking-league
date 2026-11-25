import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { assertEnabled, assertSameOrigin, paymentMode } from '../../../lib/shop/config'
import { parseAddress, parseQuantity } from '../../../lib/shop/validation'
import { getProduct, CALENDAR_SKU } from '../../../lib/shop/catalog'
import { getShipping } from '../../../lib/shop/gelato'
import { signQuote } from '../../../lib/shop/tokens'
import { errorResponse, jsonBody, rateLimit } from '../../../lib/shop/http'
import { voucherCode, voucherDiscount } from '../../../lib/shop/vouchers'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  try {
    assertEnabled(); assertSameOrigin(request); await rateLimit(request, 'quote')
    const body = await jsonBody(request), address = parseAddress(body.address), quantity = parseQuantity(body.quantity)
    const product = await getProduct(typeof body.sku === 'string' ? body.sku : CALENDAR_SKU, address.country)
    const code = voucherCode(body.voucherCode)
    const discountCents = code ? await voucherDiscount(code, product.sku, quantity * product.unit_price_cents, paymentMode()) : 0
    const methods = await getShipping(address, quantity, product)
    const token = signQuote({ id: randomUUID(), expires: Date.now() + 15 * 60 * 1000, address, quantity, methods, voucherCode: code, sku: product.sku, unitPriceCents: product.unit_price_cents, discountCents })
    return NextResponse.json({ token, methods, unitPriceCents: product.unit_price_cents, discountCents, currency: 'EUR' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) { return errorResponse(e) }
}
