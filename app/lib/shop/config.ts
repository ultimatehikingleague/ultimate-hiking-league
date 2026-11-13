import { CheckoutError } from './validation'
export const CALENDAR = {
  id: 'calendar-2027', name: "Schorschy's Wanderkalender 2027", unitPriceCents: 2990, currency: 'EUR', pageCount: 14,
  productUid: 'wall-calendars_pf_a3_pt_250-gsm-coated-silk_cl_4-4_bt_wire-with-hook-top_ver',
  fileUrl: 'https://astdepkrdkmufsydxviz.supabase.co/storage/v1/object/public/print-files/calendars/2027/schorschys-a3-300dpi-d42ee835e4e82f5f.pdf',
  fileSha256: 'd42ee835e4e82f5fb05f02073583f7f1aa4f8e7cc4ca6ee2f12ddb88707656c8',
} as const
export function required(name: string) { const value = process.env[name]; if (!value) throw new CheckoutError('Die Zahlungsfunktion ist noch nicht eingerichtet.', 503); return value }
export function shopOrigin() {
  const url = new URL(required('SHOP_ORIGIN'))
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new CheckoutError('Shop-Adresse nicht konfiguriert.', 503)
  return url.origin
}
export function checkoutEnabled() { return process.env.SHOP_CHECKOUT_ENABLED === 'true' && (process.env.SHOP_PAYMENT_MODE !== 'live' || process.env.SHOP_LIVE_APPROVED === 'true') }
export function assertEnabled() { if (!checkoutEnabled()) throw new CheckoutError('Der Verkauf startet in Kürze.', 503) }
export function paymentMode(): 'test' | 'live' {
  const mode = required('SHOP_PAYMENT_MODE')
  if (mode !== 'test' && mode !== 'live') throw new CheckoutError('Zahlungsmodus nicht konfiguriert.', 503)
  return mode
}
export function assertSameOrigin(request: Request) { if (request.headers.get('origin') !== shopOrigin()) throw new CheckoutError('Anfrage nicht erlaubt.', 403) }
