import type { ProductVariantOption } from '../components/ProductVariantSelector'

// =====================================================
// PRODUKTTYPEN
// =====================================================

export type ShopProduct = {
  id: string
  slug: string
  name: string
  category: string

  shortDescription: string
  description: string

  price: number
  currency: 'EUR'

  images: {
    src: string
    alt: string
  }[]

  features: string[]

  // Optionale Produktvarianten
  variantOptions: ProductVariantOption[]

  // Produktstatus
  status: 'active' | 'draft' | 'sold_out'

  // Versand
  requiresShipping: boolean
}

// =====================================================
// PRODUKTKATALOG
// =====================================================

export const calendarPreviewImages = [
  { src: '/shop/wanderkalender-2027/cover-final.webp', alt: 'Schorschys Wanderkalender 2027 – Titelbild' },
  { src: '/shop/wanderkalender-2027/month-1-final.webp', alt: 'Schorschys Wanderkalender – Januar 2027' },
  { src: '/shop/wanderkalender-2027/month-8-final.webp', alt: 'Schorschys Wanderkalender – August 2027' },
  { src: '/shop/wanderkalender-2027/month-12-final.webp', alt: 'Schorschys Wanderkalender – Dezember 2027' },
]

export const shopProducts: ShopProduct[] = [

  // -------------------------------------------------
  // SCHORSCHY'S WANDERKALENDER 2027
  // -------------------------------------------------

  {
    id: 'calendar-2027',

    slug: 'schorschys-wanderkalender-2027',

    name: "Schorschy's Wanderkalender 2027",

    category: 'Kalender',

    shortDescription:
      '12 Monate. 12 Abenteuer.',

    description:
      'Begleite unser Wandermurmeltier Schorschy durch ein ganzes Jahr voller Abenteuer, überraschender Begegnungen und unvergesslicher Momente. Mit zwölf liebevoll gestalteten Monatsmotiven, ausgewählten Wanderveranstaltungen aus ganz Europa und den Feiertagen in Deutschland, Österreich und der Schweiz.',

    price: 29.90,

    currency: 'EUR',

    images: calendarPreviewImages,

    features: [
      '12 individuell gestaltete Monatsmotive',
      'Ausgewählte europäische Wanderveranstaltungen',
      'Feiertage in Deutschland, Österreich und der Schweiz',
      'DIN A3 Hochformat',
      'Spiralbindung mit Aufhänger',
      'QR-Code zum Eventkalender der Ultimate Hiking League',
    ],

    // Kalender besitzt keine Größen- oder Farbvarianten.
    variantOptions: [],

    status: 'active',

    requiresShipping: true,
  },

]

// =====================================================
// PRODUKT ABRUFEN
// =====================================================

export function getShopProduct(slug: string): ShopProduct | undefined {
  return shopProducts.find(
    (product) =>
      product.slug === slug &&
      product.status !== 'draft'
  )
}

// =====================================================
// AKTIVE PRODUKTE
// =====================================================

export function getActiveShopProducts(): ShopProduct[] {
  return shopProducts.filter(
    (product) => product.status === 'active'
  )
}