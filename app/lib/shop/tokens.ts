import { createHmac, timingSafeEqual, createHash } from 'node:crypto'
import { required } from './config'
import { Address, CheckoutError } from './validation'
export type QuoteToken = { id: string; expires: number; quantity: number; sku?: string; unitPriceCents?: number; voucherCode?: string; discountCents?: number; address: Address; methods: { uid: string; name: string; shippingCents: number }[] }
function secret() { const s = required('SHOP_TOKEN_SECRET'); if (s.length < 32) throw new CheckoutError('Shop noch nicht konfiguriert.', 503); return s }
export function signQuote(data: QuoteToken) { const payload = Buffer.from(JSON.stringify(data)).toString('base64url'); return payload + '.' + createHmac('sha256', secret()).update(payload).digest('base64url') }
export function readQuote(token: unknown): QuoteToken {
  if (typeof token !== 'string' || token.length > 12000) throw new CheckoutError('Versandangebot ungültig.')
  const parts = token.split('.'); if (parts.length !== 2) throw new CheckoutError('Versandangebot ungültig.')
  const signature = createHmac('sha256', secret()).update(parts[0]).digest()
  const provided = Buffer.from(parts[1], 'base64url')
  if (signature.length !== provided.length || !timingSafeEqual(signature, provided)) throw new CheckoutError('Versandangebot ungültig.')
  let data: QuoteToken
  try { data = JSON.parse(Buffer.from(parts[0], 'base64url').toString()) } catch { throw new CheckoutError('Versandangebot ungültig.') }
  if (!Number.isFinite(data.expires) || data.expires < Date.now()) throw new CheckoutError('Versandangebot abgelaufen. Bitte erneut berechnen.')
  return data
}
export function tokenHash(token: string) { return createHash('sha256').update(token).digest('hex') }
export function accessToken(id: string) { return createHmac('sha256', secret()).update('order-access:' + id).digest('hex') }
export function validAccess(token: unknown, hash: string) { return typeof token === 'string' && /^[a-f0-9]{64}$/.test(token) && typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash) && timingSafeEqual(Buffer.from(tokenHash(token)), Buffer.from(hash)) }

export function orderCookie(id: string) { return `shop-order-${id}` }
