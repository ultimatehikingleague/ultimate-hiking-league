import type { CatalogProduct } from './catalog'
import { randomUUID } from 'node:crypto'
import { CALENDAR, required } from './config'
import { Address, CheckoutError, moneyCents } from './validation'
export type ShippingMethod = { uid: string; name: string; shippingCents: number; carrierCents: number; shippingBaseCents: number; minDays: number; maxDays: number }
export function parseQuote(data: unknown, _country: string): ShippingMethod[] {
  if (!['DE', 'AT', 'CH'].includes(_country)) throw new CheckoutError('Für dieses Land ist kein Versand verfügbar.', 422)
  const result = data as { quotes?: { itemReferenceIds?: string[]; carrierSurcharge?: { price: unknown; currency: string }; shipmentMethods?: { shipmentMethodUid: string; name: string; price: unknown; currency: string; isPrivate?: boolean; type: string; minDeliveryDays: number; maxDeliveryDays: number }[] }[]; errors?: unknown[] }
  if (!result || result.errors?.length || result.quotes?.length !== 1) throw new CheckoutError('Für diese Lieferung ist derzeit kein verlässlicher Versandpreis verfügbar.', 502)
  const quote = result.quotes[0]
  if (!quote.itemReferenceIds?.includes(CALENDAR.id)) throw new CheckoutError('Versandangebot passt nicht zum Kalender.', 502)
  const carrier = quote.carrierSurcharge
  if (carrier && carrier.currency !== 'EUR') throw new CheckoutError('Versandwährung ungültig.', 502)
  const carrierCents = carrier ? moneyCents(carrier.price) : 0
  // Only the quoted shipping price is charged to the customer. ULTIMATE absorbs
  // production costs, carrier surcharges and procurement taxes.
  const methods = (quote.shipmentMethods ?? []).filter(m => m.currency === 'EUR' && m.isPrivate !== false && ['normal', 'standard', 'express'].includes(m.type)).map(m => {
    const shippingBaseCents = moneyCents(m.price)
    return { uid: m.shipmentMethodUid, name: m.name, shippingBaseCents, carrierCents, shippingCents: shippingBaseCents, minDays: m.minDeliveryDays, maxDays: m.maxDeliveryDays }
  })
  if (!methods.length) throw new CheckoutError('Für diese Adresse ist kein Versand verfügbar.', 422)
  return methods.sort((a, b) => a.shippingCents - b.shippingCents)
}
export async function getShipping(address: Address, quantity: number, product?: CatalogProduct) {
  const response = await fetch('https://order.gelatoapis.com/v4/orders:quote', {
    method: 'POST', headers: { 'X-API-KEY': required('GELATO_API_KEY'), 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'ULTIMATE-Checkout/1.0' },
    body: JSON.stringify({ orderReferenceId: `quote-${randomUUID()}`, customerReferenceId: 'ultimate-shop-quote', currency: 'EUR', allowMultipleQuotes: false, recipient: address, products: [{ itemReferenceId: CALENDAR.id, productUid: product?.gelato_product_uid ?? CALENDAR.productUid, pageCount: product?.page_count ?? CALENDAR.pageCount, quantity, files: [{ type: 'default', url: product?.file_url ?? CALENDAR.fileUrl }] }] }),
    signal: AbortSignal.timeout(25000), cache: 'no-store',
  })
  if (!response.ok) throw new CheckoutError('Versandpreise sind gerade nicht verfügbar. Bitte später erneut versuchen.', 502)
  return parseQuote(await response.json(), address.country)
}
