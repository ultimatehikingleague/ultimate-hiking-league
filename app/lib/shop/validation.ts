export type Address = { firstName: string; lastName: string; addressLine1: string; addressLine2: string; postCode: string; city: string; country: string; email: string; phone: string }
export class CheckoutError extends Error { constructor(message: string, public status = 400) { super(message) } }
export function parseAddress(value: unknown): Address {
  if (!value || typeof value !== 'object') throw new CheckoutError('Bitte Lieferadresse eingeben.')
  const raw = value as Record<string, unknown>
  const limits = { firstName: 25, lastName: 25, addressLine1: 35, addressLine2: 35, postCode: 15, city: 30, country: 2, email: 254, phone: 25 }
  const result: Record<string, string> = {}
  for (const [key, max] of Object.entries(limits)) {
    const text = typeof raw[key] === 'string' ? (raw[key] as string).trim() : ''
    if (text.length > max || /[\x00-\x1f]/.test(text) || (!text && !['addressLine2', 'phone'].includes(key))) throw new CheckoutError('Bitte Lieferadresse vollständig und korrekt eingeben.')
    result[key] = text
  }
  if (!['DE', 'AT', 'CH'].includes(result.country) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw new CheckoutError('Lieferland oder E-Mail-Adresse ungültig.')
  if (!(result.country === 'DE' ? /^\d{5}$/ : /^\d{4}$/).test(result.postCode)) throw new CheckoutError('Postleitzahl ungültig.')
  return result as Address
}
export function parseQuantity(value: unknown) {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 10) throw new CheckoutError('Bitte eine Menge zwischen 1 und 10 wählen.')
  return value as number
}
export function moneyCents(value: unknown): number {
  if ((typeof value !== 'number' && typeof value !== 'string') || !/^\d+(\.\d{1,2})?$/.test(String(value))) throw new CheckoutError('Ungültiger Preis vom Zahlungs- oder Versanddienst.', 502)
  const cents = Math.round(Number(value) * 100)
  if (!Number.isSafeInteger(cents)) throw new CheckoutError('Ungültiger Betrag.', 502)
  return cents
}
export function formatMoney(cents: number) { return (cents / 100).toFixed(2) }
