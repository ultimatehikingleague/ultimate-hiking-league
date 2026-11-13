import { NextResponse } from 'next/server'
import { CheckoutError } from './validation'
import { createHmac } from 'node:crypto'
import { required } from './config'
import { orderDB } from './orders'
export async function jsonBody(request: Request) {
  const text = await request.text()
  if (text.length > 16000) throw new CheckoutError('Anfrage zu groß.', 413)
  try { return JSON.parse(text) } catch { throw new CheckoutError('Ungültige Anfrage.') }
}
export function errorResponse(error: unknown) {
  if (!(error instanceof CheckoutError)) console.error('Shop request failed', error instanceof Error ? error.name : 'unknown')
  return NextResponse.json({ error: error instanceof CheckoutError ? error.message : 'Die Anfrage konnte nicht abgeschlossen werden. Bitte später erneut versuchen.' }, { status: error instanceof CheckoutError ? error.status : 500, headers: { 'Cache-Control': 'no-store' } })
}
export async function rateLimit(request: Request, scope: string) {
  // Vercel supplies x-real-ip. Never store the customer's raw IP address.
  const ip = process.env.VERCEL ? request.headers.get('x-real-ip') ?? 'unknown' : 'local'
  const key = createHmac('sha256', required('SHOP_TOKEN_SECRET')).update(scope + ':' + ip).digest('hex')
  const { data, error } = await orderDB().rpc('shop_rate_limit', { p_key: key, p_limit: 15 })
  if (error) throw new CheckoutError('Shop vorübergehend nicht verfügbar.', 503)
  if (!data) throw new CheckoutError('Zu viele Anfragen. Bitte eine Minute warten.', 429)
}
