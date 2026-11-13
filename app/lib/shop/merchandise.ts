import type { ShippingConfig } from './shipping-config'

export const productStatuses = ['draft', 'active', 'paused', 'archived'] as const
export const productWorlds = ['league', 'outdoor'] as const
export const fulfillmentTypes = ['self', 'gelato'] as const
export const merchandiseSku = /^[A-Z0-9][A-Z0-9_-]{1,63}$/
export const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i

export const statusLabels = {
  draft: 'Entwurf', active: 'Aktiv (intern)', paused: 'Pausiert', archived: 'Archiviert',
}
export const worldLabels = { league: 'ULTIMATE HIKING LEAGUE', outdoor: 'ULTIMATE OUTDOOR' }
export const fulfillmentLabels = { self: 'Eigenversand', gelato: 'Gelato' }

export type Merchandise = {
  sku: string
  name: string
  description: string
  price_cents: number | null
  category: string
  product_world: typeof productWorlds[number]
  collection: string
  image_urls: string[]
  status: typeof productStatuses[number]
  fulfillment_type: typeof fulfillmentTypes[number]
  parent_sku: string | null
  stock_on_hand: number
  stock_reserved: number
  stock_sold: number
  shipping_config: ShippingConfig | null
  version: string
}

export function httpsUrl(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 2048 || !/^https:\/\//i.test(input)) return null
  try {
    const url = new URL(input)
    return !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}
