import { NextResponse, NextRequest } from 'next/server'
import { getOrder } from '../../../lib/shop/orders'
import { validAccess, orderCookie } from '../../../lib/shop/tokens'
import { errorResponse } from '../../../lib/shop/http'
import { CheckoutError } from '../../../lib/shop/validation'
export const runtime = 'nodejs'
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url), id = url.searchParams.get('order')
    if (!id || !/^[a-f0-9-]{36}$/.test(id)) throw new CheckoutError('Bestellung nicht gefunden.', 404)
    const order = await getOrder(id)
    if (!order || !validAccess(request.cookies.get(orderCookie(id))?.value, order.access_token_hash)) throw new CheckoutError('Bestellung nicht gefunden.', 404)
    return NextResponse.json({ id: order.id, status: order.status, totalCents: order.total_cents, currency: order.currency }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) { return errorResponse(e) }
}
