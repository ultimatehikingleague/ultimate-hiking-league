import { NextResponse } from 'next/server'
import { required } from '../../../../lib/shop/config'
import { paypalRequest, reconcilePayPal } from '../../../../lib/shop/paypal'
import { orderDB, ShopOrder } from '../../../../lib/shop/orders'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  try {
    const raw = await request.text()
    if (raw.length > 1000000) return new Response('Too large', { status: 413 })
    const signatureHeaders = ['paypal-auth-algo', 'paypal-cert-url', 'paypal-transmission-id', 'paypal-transmission-sig', 'paypal-transmission-time']
    if (signatureHeaders.some(name => !request.headers.get(name))) return new Response('Missing webhook signature', { status: 400 })
    let event
    try { event = JSON.parse(raw) } catch { return new Response('Invalid JSON', { status: 400 }) }
    const verification = await paypalRequest('/v1/notifications/verify-webhook-signature', 'POST', {
      auth_algo: request.headers.get('paypal-auth-algo'), cert_url: request.headers.get('paypal-cert-url'), transmission_id: request.headers.get('paypal-transmission-id'), transmission_sig: request.headers.get('paypal-transmission-sig'), transmission_time: request.headers.get('paypal-transmission-time'), webhook_id: required('PAYPAL_WEBHOOK_ID'), webhook_event: event,
    })
    if (verification.verification_status !== 'SUCCESS') return new Response('Invalid webhook signature', { status: 400 })
    if (['PAYMENT.CAPTURE.COMPLETED', 'CHECKOUT.ORDER.APPROVED'].includes(event.event_type)) {
      const providerId = event.event_type === 'CHECKOUT.ORDER.APPROVED' ? event.resource?.id : event.resource?.supplementary_data?.related_ids?.order_id
      if (typeof providerId !== 'string') return new Response('Missing order ID', { status: 400 })
      const { data, error } = await orderDB().from('shop_orders').select('*').eq('provider', 'paypal').eq('provider_order_id', providerId).maybeSingle()
      if (error || !data) return new Response('Order association pending; retry required', { status: 500 })
      await reconcilePayPal(data as ShopOrder, event.event_type === 'CHECKOUT.ORDER.APPROVED')
    }
    return NextResponse.json({ received: true })
  } catch { return new Response('Webhook processing failed; retry required', { status: 500 }) }
}
