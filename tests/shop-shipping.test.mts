import assert from 'node:assert/strict'
import test from 'node:test'
import { fitsStandardLetter, readShippingConfig, readShippingRate, type ShippingRate } from '../app/lib/shop/shipping-config'
import { prepareShippingQuote, selectedShippingTotal, type OwnParcel, type ShippingLine } from '../app/lib/shop/shipping-quote'

const standard = 'DP-STANDARD-DE'
const packageSize = { lengthMm: 150, widthMm: 100, depthMm: 3, weightG: 12 }
const rate = {
  code: standard, name: 'Standardbrief', carrier: 'Deutsche Post', mode: 'self', partner: null, zone: 'Deutschland',
  countries: ['DE'], price_cents: 95, max_length_mm: 235, max_width_mm: 125, max_depth_mm: 5,
  max_weight_g: 20, tracking: null, delivery_estimate: null, active: true, valid_through: '2026-12-31', version: '',
} satisfies ShippingRate
const parcelRate: ShippingRate = {
  ...rate, code: 'DHL-PAKET', carrier: 'DHL', countries: ['DE', 'AT'], price_cents: 600,
  max_length_mm: 500, max_width_mm: 500, max_depth_mm: 500, max_weight_g: 2000, valid_through: null,
}
const gelatoRate: ShippingRate = {
  ...rate, code: 'GELATO', mode: 'partner', partner: 'gelato', countries: ['DE', 'AT'],
  price_cents: null, valid_through: null,
}
const patch: ShippingLine = {
  sku: 'PATCH', saleApproved: true, quantity: 1, fulfillment: 'self', available: 98,
  config: { rateCodes: [standard, parcelRate.code], package: packageSize, standardLetterVerified: true, domesticOnly: true, countries: [] },
}
const calendar: ShippingLine = {
  sku: 'CALENDAR', saleApproved: true, quantity: 2, fulfillment: 'gelato', available: null,
  config: { rateCodes: [gelatoRate.code], package: null, standardLetterVerified: false, domesticOnly: false, countries: ['DE', 'AT'] },
}
const own: OwnParcel = {
  id: 'box', quantities: [{ sku: patch.sku, quantity: 1 }], measurements: packageSize, standardLetterVerified: true,
}
const partnerOffer = { rateCode: 'GELATO', methodId: 'provider-dhl', priceCents: 574, currency: 'EUR' }
const quote = (lines: ShippingLine[], parcels: OwnParcel[], overrides: Partial<Parameters<typeof prepareShippingQuote>[0]> = {}) =>
  prepareShippingQuote({ country: 'DE', rates: [rate, parcelRate, gelatoRate], lines, parcels,
    quotePartner: async () => [partnerOffer], now: new Date('2026-11-08T10:00:00Z'), ...overrides })

test('single parcel returns compatible methods, selected once at its configured price', async () => {
  const shipping = await quote([patch], [own])
  assert.deepEqual(shipping[0].options.map(option => option.priceCents), [95, 600])
  assert.equal(selectedShippingTotal(shipping, [{ shipmentId: 'self:box', methodId: standard, priceCents: 0 } as {shipmentId: string; methodId: string}]), 95)
  assert.throws(() => selectedShippingTotal(shipping, [{ shipmentId: 'self:box', methodId: 'FORGED' }]), /Invalid shipping selection/)
})

test('a shared parcel is charged once and uses only rates common to all products', async () => {
  const second = { ...patch, sku: 'OTHER', config: { ...patch.config, rateCodes: [parcelRate.code] } }
  const shipping = await quote([patch, second], [{
    ...own, quantities: [...own.quantities, { sku: second.sku, quantity: 1 }],
    measurements: { ...packageSize, weightG: 23 },
  }])
  assert.deepEqual(shipping[0].options.map(option => option.rateCode), [parcelRate.code])
  assert.equal(selectedShippingTotal(shipping, [{ shipmentId: 'self:box', methodId: parcelRate.code }]), 600)
})

test('partner-only and mixed carts ask each provider once and sum separate shipments', async () => {
  let calls = 0
  const quotePartner = async ({ partner, lines, country }: Parameters<Parameters<typeof prepareShippingQuote>[0]['quotePartner']>[0]) => {
    calls++
    assert.equal(partner, 'gelato')
    assert.ok(['DE', 'AT'].includes(country))
    assert.deepEqual(lines, [calendar])
    return [partnerOffer]
  }
  const partner = { shipmentId: 'partner:gelato', methodId: partnerOffer.methodId }
  const ownSelection = { shipmentId: 'self:box', methodId: standard }
  assert.equal(selectedShippingTotal(await quote([calendar], [], { country: 'AT', quotePartner }), [partner]), 574)
  const mixed = await quote([patch, calendar], [own], { quotePartner })
  assert.equal(calls, 2)
  assert.equal(selectedShippingTotal(mixed, [ownSelection, partner]), 669)
  assert.throws(() => selectedShippingTotal(mixed, [partner, partner]), /Select one/)
  await assert.rejects(quote([calendar], [], { quotePartner: async () => [{ ...partnerOffer, currency: 'USD' }] }), /Invalid partner/)
})

test('fails closed for unconfirmed packing, expired rates, disallowed countries and insufficient stock', async () => {
  const onlyStandard = { ...patch, config: { ...patch.config, rateCodes: [standard] } }
  await assert.rejects(quote([onlyStandard], [own], { rates: [{ ...rate, active: false }] }), /No eligible/)
  await assert.rejects(quote([onlyStandard], [own], { now: new Date('2026-12-31T23:00:00Z') }), /No eligible/)
  await assert.rejects(quote([onlyStandard], [{ ...own, standardLetterVerified: false }]), /No eligible/)
  await assert.rejects(quote([{ ...onlyStandard, config: { ...onlyStandard.config, standardLetterVerified: false } }], [own]), /No eligible/)
  await assert.rejects(quote([onlyStandard], [{ ...own, measurements: { ...packageSize, depthMm: 6 } }]), /No eligible/)
  await assert.rejects(quote([patch], [own], { country: 'AT' }), /Destination excluded/)
  await assert.rejects(quote([{ ...patch, saleApproved: false }], [own]), /no public sale approval/)
  await assert.rejects(quote([patch], []), /does not cover/)
  await assert.rejects(quote([patch], [own, { ...own, id: 'other' }]), /does not match/)
  await assert.rejects(quote([{ ...patch, available: 0 }], [own]), /Insufficient stock/)
  assert.equal(fitsStandardLetter({ lengthMm: 140, widthMm: 100, depthMm: 5, weightG: 20 }), true)
  assert.equal(fitsStandardLetter({ lengthMm: 140, widthMm: 125, depthMm: 5, weightG: 20 }), false)
  assert.throws(() => readShippingConfig({ ...patch.config, package: null }), /Postgrenzen/)
  assert.throws(() => readShippingRate({ ...rate, max_depth_mm: 6 }), /Postgrenzen/)
})
