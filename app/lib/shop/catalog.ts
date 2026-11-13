import { orderDB } from './orders'
import { CheckoutError } from './validation'
export const CALENDAR_SKU = 'UHL-KAL-2027-A3'
export type CatalogProduct = { sku: string; name: string; unit_price_cents: number; currency: string; active: boolean; gelato_product_uid: string; file_url: string; file_sha256: string; page_count: number }
export async function getProduct(sku: string, country?: string): Promise<CatalogProduct> {
 const db=orderDB()
 const {data,error}=await db.from('shop_catalog_products').select('*').eq('sku',sku).eq('active',true).maybeSingle()
 if(error || !data) throw new CheckoutError('Dieser Artikel ist derzeit nicht bestellbar.',503)
 if(country){const region=await db.from('shop_shipping_regions').select('country').eq('country',country).eq('enabled',true).maybeSingle();if(region.error||!region.data)throw new CheckoutError('Lieferung in dieses Land derzeit nicht möglich.',422)}
 return data as CatalogProduct
}
