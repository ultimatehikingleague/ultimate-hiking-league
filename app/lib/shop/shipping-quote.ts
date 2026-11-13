import {
  fitsStandardLetter, readPackage, standardLetterCode, type PackageMeasurements, type ShippingConfig, type ShippingRate,
} from './shipping-config'

export type ShippingLine = {
  sku: string
  quantity: number
  fulfillment: string
  available: number | null
  saleApproved: boolean
  config: ShippingConfig
}

export type OwnParcel = {
  id: string
  quantities: { sku: string; quantity: number }[]
  measurements: PackageMeasurements
  standardLetterVerified: boolean
}

export type ShippingOption = {
  rateCode: string
  methodId: string
  priceCents: number
}

type PartnerQuote = (group: {
  partner: string; country: string; lines: ShippingLine[]; rates: ShippingRate[]
}) => Promise<(ShippingOption & { currency: string })[]>

type ShipmentQuote = { id: string; options: ShippingOption[] }

const validCents = (value: number) => Number.isSafeInteger(value) && value >= 0 && value <= 1000000
const quantityIsValid = (value: number) => Number.isSafeInteger(value) && value > 0 && value <= 1000
const measurementsFit = (item: PackageMeasurements, parcel: PackageMeasurements) =>
  item.lengthMm <= parcel.lengthMm && item.widthMm <= parcel.widthMm &&
  item.depthMm <= parcel.depthMm && item.weightG <= parcel.weightG

function ownRateFits(rate: ShippingRate, parcel: OwnParcel, lines: ShippingLine[]) {
  const { max_length_mm: length, max_width_mm: width, max_depth_mm: depth, max_weight_g: weight } = rate
  if (length === null || width === null || depth === null || weight === null) return false
  if (!measurementsFit(parcel.measurements, { lengthMm: length, widthMm: width, depthMm: depth, weightG: weight })) return false
  return rate.code !== standardLetterCode || (parcel.standardLetterVerified && fitsStandardLetter(parcel.measurements)
    && lines.every(line => line.config.standardLetterVerified && line.config.package && fitsStandardLetter(line.config.package)))
}

/**
 * Accept only server-loaded catalog and inventory data, a verified packing plan and
 * provider quotes. This module is deliberately disconnected from the live checkout.
 */
export async function prepareShippingQuote({
  country, lines, parcels, rates, quotePartner, now = new Date(),
}: {
  country: string
  lines: ShippingLine[]
  parcels: OwnParcel[]
  rates: ShippingRate[]
  quotePartner: PartnerQuote
  now?: Date
}): Promise<ShipmentQuote[]> {
  if (!/^[A-Z]{2}$/.test(country) || !lines.length || lines.length > 100 || parcels.length > 100) throw Error('Invalid shipping request')
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const eligible = rates.filter(rate => rate.active && rate.countries.includes(country)
    && (!rate.valid_through || rate.valid_through >= today))
  if (new Set(eligible.map(rate => rate.code)).size !== eligible.length) throw Error('Duplicate shipping rate')

  const allLines = new Map<string, ShippingLine>()
  const remaining = new Map<string, number>()
  const partners = new Map<string, ShippingLine[]>()
  for (const line of lines) {
    if (!line.saleApproved) throw Error('Product has no public sale approval')
    if (!quantityIsValid(line.quantity) || allLines.has(line.sku)) throw Error('Invalid or duplicate SKU quantity')
    if ((line.config.domesticOnly && country !== 'DE') ||
        (line.config.countries.length && !line.config.countries.includes(country))) throw Error('Destination excluded by product')
    allLines.set(line.sku, line)
    if (line.fulfillment === 'self') {
      if (line.available === null || !Number.isSafeInteger(line.available) || line.available < line.quantity) throw Error('Insufficient stock')
      remaining.set(line.sku, line.quantity)
    } else {
      const group = partners.get(line.fulfillment) ?? []
      group.push(line)
      partners.set(line.fulfillment, group)
    }
  }

  const ownQuotes: ShipmentQuote[] = []
  const seenParcels = new Set<string>()
  for (const parcel of parcels) {
    if (!parcel.id || seenParcels.has(parcel.id) || !parcel.quantities.length) throw Error('Invalid or duplicate parcel')
    seenParcels.add(parcel.id)
    const measurements = readPackage(parcel.measurements)
    const packed: ShippingLine[] = []
    const packedSkus = new Set<string>()
    for (const item of parcel.quantities) {
      const left = remaining.get(item.sku)
      const line = allLines.get(item.sku)
      if (!line || left === undefined || !quantityIsValid(item.quantity) || item.quantity > left || packedSkus.has(item.sku)) {
        throw Error('Packing plan does not match cart')
      }
      if (!line.config.package || !measurementsFit(line.config.package, measurements)) throw Error('Packed measurements are missing or inconsistent')
      packedSkus.add(item.sku)
      remaining.set(item.sku, left - item.quantity)
      packed.push(line)
    }
    const options = eligible.flatMap(rate => rate.mode === 'self' && rate.price_cents !== null && validCents(rate.price_cents)
      && packed.every(line => line.config.rateCodes.includes(rate.code)) && ownRateFits(rate, parcel, packed)
      ? [{ rateCode: rate.code, methodId: rate.code, priceCents: rate.price_cents }] : [])
    if (!options.length) throw Error('No eligible rate for own parcel')
    ownQuotes.push({ id: 'self:' + parcel.id, options })
  }
  if ([...remaining.values()].some(quantity => quantity !== 0)) throw Error('Packing plan does not cover all own items')

  const partnerGroups = [...partners].map(([partner, group]) => {
    const allowed = eligible.filter(rate => rate.mode === 'partner' && rate.partner === partner
      && group.every(line => line.config.rateCodes.includes(rate.code)))
    if (!allowed.length) throw Error('No eligible partner rate')
    return { partner, country, lines: group, rates: allowed }
  })
  const partnerQuotes = await Promise.all(partnerGroups.map(async group => {
    const options = await quotePartner(group)
    const methods = new Set<string>()
    if (!options.length) throw Error('Partner returned no shipping options')
    for (const option of options) {
      if (option.currency !== 'EUR' || !validCents(option.priceCents) || !option.methodId || methods.has(option.methodId)
          || !group.rates.some(rate => rate.code === option.rateCode)) throw Error('Invalid partner shipping quote')
      methods.add(option.methodId)
    }
    return { id: 'partner:' + group.partner, options: options.map(({ methodId, rateCode, priceCents }) => ({ methodId, rateCode, priceCents })) }
  }))
  return [...ownQuotes, ...partnerQuotes]
}

/** Only the selected method identifiers may come from the browser. */
export function selectedShippingTotal(quote: ShipmentQuote[], selections: { shipmentId: string; methodId: string }[]) {
  const selected = new Map(selections.map(selection => [selection.shipmentId, selection.methodId]))
  if (!quote.length || quote.length !== selections.length || selected.size !== selections.length ||
      new Set(quote.map(shipment => shipment.id)).size !== quote.length) throw Error('Select one method per shipment')
  return quote.reduce((total, shipment) => {
    const method = shipment.options.find(option => option.methodId === selected.get(shipment.id))
    if (!method || !validCents(method.priceCents)) throw Error('Invalid shipping selection')
    return total + method.priceCents
  }, 0)
}
