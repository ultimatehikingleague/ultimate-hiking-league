import { NextResponse } from 'next/server'
import { stripeClient, reconcileStripe } from '../../../../lib/shop/stripe'
import { paymentMode, required } from '../../../../lib/shop/config'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  let event
  try {
    const raw = await request.text()
    if (raw.length > 1000000) return new Response('Too large', { status: 413 })
    event = stripeClient().webhooks.constructEvent(raw, request.headers.get('stripe-signature') ?? '', required('STRIPE_WEBHOOK_SECRET'))
  } catch { return new Response('Webhook signature verification failed', { status: 400 }) }
  if (event.livemode !== (paymentMode() === 'live')) return new Response('Payment mode mismatch', { status: 400 })
  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') await reconcileStripe(event.data.object.id)
    return NextResponse.json({ received: true })
  } catch { return new Response('Payment processing failed; retry required', { status: 500 }) }
}
