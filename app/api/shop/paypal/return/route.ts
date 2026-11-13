import { NextResponse, NextRequest } from 'next/server'
import { assertSameOrigin } from '../../../../lib/shop/config'
import { CheckoutError } from '../../../../lib/shop/validation'
import { validAccess, orderCookie } from '../../../../lib/shop/tokens'
import { getOrder } from '../../../../lib/shop/orders'
import { reconcilePayPal } from '../../../../lib/shop/paypal'
import { errorResponse, jsonBody, rateLimit } from '../../../../lib/shop/http'
export const runtime = 'nodejs'
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request); await rateLimit(request, 'paypal-capture')
    const body = await jsonBody(request)
    if (typeof body.order !== 'string' || !/^[a-f0-9-]{36}$/.test(body.order)) throw new CheckoutError('Bestellung ungültig.', 404)
    const order = await getOrder(body.order)
    if (!order || !validAccess(request.cookies.get(orderCookie(body.order))?.value, order.access_token_hash) || order.provider !== 'paypal') throw new CheckoutError('Bestellung nicht gefunden.', 404)
    await reconcilePayPal(order, true)
    return NextResponse.json({ received: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) { return errorResponse(e) }
}
