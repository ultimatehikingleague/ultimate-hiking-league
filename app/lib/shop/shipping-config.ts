import { merchandiseSku, uuid } from './merchandise'

export const standardLetterCode = 'DP-STANDARD-DE'
export const packageFields = ['lengthMm', 'widthMm', 'depthMm', 'weightG'] as const
export type PackageMeasurements = Record<typeof packageFields[number], number>

export type ShippingConfig = {
  rateCodes: string[]
  domesticOnly: boolean
  countries: string[]
  package: PackageMeasurements | null
  standardLetterVerified: boolean
}

export type ShippingRate = {
  code: string
  name: string
  carrier: string
  mode: 'self' | 'partner'
  partner: string | null
  zone: string
  countries: string[]
  price_cents: number | null
  max_length_mm: number | null
  max_width_mm: number | null
  max_depth_mm: number | null
  max_weight_g: number | null
  tracking: boolean | null
  delivery_estimate: string | null
  valid_through: string | null
  active: boolean
  version: string
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

export function countries(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 249 || value.some(code => typeof code !== 'string' || !/^[A-Z]{2}$/.test(code))) {
    throw Error('Bitte gültige zweistellige Ländercodes eingeben.')
  }
  return [...new Set<string>(value)]
}

function integer(value: unknown, max: number, min = 1): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw Error('Ungültige Zahl.')
  return value
}

export function readPackage(value: unknown): PackageMeasurements {
  const row = record(value)
  const dimensions = {
    lengthMm: integer(row.lengthMm, 100000), widthMm: integer(row.widthMm, 100000),
    depthMm: integer(row.depthMm, 100000), weightG: integer(row.weightG, 10000000),
  }
  if (dimensions.lengthMm < dimensions.widthMm) throw Error('Die Länge muss mindestens der Breite entsprechen.')
  return dimensions
}

export function fitsStandardLetter(size: PackageMeasurements) {
  return size.lengthMm >= 140 && size.lengthMm <= 235 && size.widthMm >= 90 && size.widthMm <= 125
    && size.lengthMm * 10 >= size.widthMm * 14 && size.depthMm <= 5 && size.weightG <= 20
}

export function readShippingConfig(value: unknown): ShippingConfig | null {
  if (value === null) return null
  const row = record(value)
  if (!Array.isArray(row.rateCodes) || row.rateCodes.length > 50 ||
      row.rateCodes.some(code => typeof code !== 'string' || !merchandiseSku.test(code)) ||
      typeof row.domesticOnly !== 'boolean' || typeof row.standardLetterVerified !== 'boolean') {
    throw Error('Ungültige Versandkonfiguration.')
  }
  const rateCodes = [...new Set<string>(row.rateCodes)]
  const pack = row.package === null ? null : readPackage(row.package)
  if (row.standardLetterVerified && (!rateCodes.includes(standardLetterCode) || !pack || !fitsStandardLetter(pack))) {
    throw Error('Für den Standardbrief müssen die verpackten Maße und das Gewicht innerhalb der Postgrenzen liegen.')
  }
  return { rateCodes, domesticOnly: row.domesticOnly, countries: countries(row.countries), package: pack, standardLetterVerified: row.standardLetterVerified }
}

export function readShippingRate(value: unknown): ShippingRate {
  const row = record(value)
  function label(input: unknown, max: number) {
    if (typeof input !== 'string' || !input.trim() || input.trim().length > max) throw Error('Bitte alle Pflichtfelder ausfüllen.')
    return input.trim()
  }
  if (typeof row.code !== 'string' || !merchandiseSku.test(row.code) ||
      (row.mode !== 'self' && row.mode !== 'partner') || typeof row.active !== 'boolean' ||
      (row.tracking !== null && typeof row.tracking !== 'boolean') ||
      (row.version !== '' && (typeof row.version !== 'string' || !uuid.test(row.version)))) throw Error('Ungültige Versandart.')
  const partner = row.mode === 'partner' ? label(row.partner, 40) : null
  if (partner && !/^[a-z][a-z0-9_-]{1,39}$/.test(partner)) throw Error('Ungültige Partnerkennung.')
  const date = row.valid_through === null ? null : label(row.valid_through, 10)
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date)) throw Error('Ungültiges Ablaufdatum.')
  const rate: ShippingRate = {
    code: row.code, mode: row.mode, partner, active: row.active, version: row.version as string,
    name: label(row.name, 120), carrier: label(row.carrier, 120), zone: label(row.zone, 80),
    countries: countries(row.countries), tracking: row.tracking, valid_through: date,
    delivery_estimate: row.delivery_estimate === null ? null : label(row.delivery_estimate, 120),
    price_cents: row.mode === 'partner' || row.price_cents === null ? null : integer(row.price_cents, 1000000, 0),
    max_length_mm: row.max_length_mm === null ? null : integer(row.max_length_mm, 100000),
    max_width_mm: row.max_width_mm === null ? null : integer(row.max_width_mm, 100000),
    max_depth_mm: row.max_depth_mm === null ? null : integer(row.max_depth_mm, 100000),
    max_weight_g: row.max_weight_g === null ? null : integer(row.max_weight_g, 10000000),
  }
  if (rate.active && (!rate.countries.length || (rate.mode === 'self' && [
    rate.price_cents, rate.max_length_mm, rate.max_width_mm, rate.max_depth_mm, rate.max_weight_g,
  ].some(limit => limit === null)))) throw Error('Für aktive Tarife fehlen Länder, Preis oder Paketgrenzen.')
  if (rate.code === standardLetterCode && (rate.mode !== 'self' || rate.countries.join() !== 'DE' ||
      (rate.max_length_mm ?? 0) > 235 || (rate.max_width_mm ?? 0) > 125 ||
      (rate.max_depth_mm ?? 0) > 5 || (rate.max_weight_g ?? 0) > 20)) {
    throw Error('Der Standardbrief Deutschland muss innerhalb der bestätigten Postgrenzen bleiben.')
  }
  return rate
}
