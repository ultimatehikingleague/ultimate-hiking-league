import { shopAdminId } from '../../../../lib/requireShopAdmin'
import { fulfillmentTypes, httpsUrl, merchandiseSku, productStatuses, productWorlds, uuid } from '../../../../lib/shop/merchandise'
import { managedImagePath, maxProductImages } from '../../../../lib/shop/product-images'
import { readShippingConfig } from '../../../../lib/shop/shipping-config'
import { orderDB } from '../../../../lib/shop/orders'

export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization' }
const reply = (data: unknown, status = 200) => Response.json(data, { headers, status })
const forbidden = () => reply({ error: 'Zugriff verweigert.' }, 403)
const invalid = () => reply({ error: 'Bitte überprüfe die Eingaben.' }, 400)
const unavailable = () => reply({ error: 'Produktverwaltung derzeit nicht verfügbar.' }, 503)
const conflict = () => reply({ error: 'Die Aktion steht im Konflikt mit gespeicherten Daten. Bitte den aktuellen Stand prüfen.' }, 409)
const fields = 'sku,name,description,price_cents,category,product_world,collection,image_urls,status,fulfillment_type,parent_sku,stock_on_hand,stock_reserved,stock_sold,shipping_config,version'
const isSku = (v: unknown): v is string => typeof v === 'string' && merchandiseSku.test(v)
const isId = (v: unknown): v is string => typeof v === 'string' && uuid.test(v)
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length <= max
const money = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= 2147483647
const oneOf = <T extends string>(v: unknown, values: readonly T[]): v is T =>
  typeof v === 'string' && values.some(value => value === v)

export async function GET(request: Request) {
  try {
    if (!await shopAdminId(request)) return forbidden()
    const params = new URL(request.url).searchParams
    const sku = params.get('sku')
    const after = params.get('after')
    const db = orderDB()
    if (sku !== null) {
      if (!isSku(sku)) return invalid()
      const { data, error } = await db.from('shop_inventory_entries')
        .select('id,order_line_id,quantity,state,reason,actor_id,created_at,settled_at')
        .eq('sku', sku).order('created_at', { ascending: false }).limit(30)
      return error ? unavailable() : reply({ entries: data })
    }
    if (after !== null && !isSku(after)) return invalid()
    let managed = db.from('shop_merchandise').select(fields).order('sku').limit(51)
    if (after) managed = managed.gt('sku', after)
    const [products, catalog, legacy] = await Promise.all([
      managed,
      after ? null : db.from('shop_catalog_products').select('sku,name,unit_price_cents,currency,active').order('sku').limit(100),
      after ? null : db.from('shop_products').select('id,slug,name,status,price_cents,currency').order('created_at', { ascending: false }).limit(100),
    ])
    if (products.error || catalog?.error || legacy?.error) return unavailable()
    const rows = products.data.slice(0, 50)
    return reply({ products: rows, more: products.data.length > 50, cursor: rows.at(-1)?.sku ?? null, catalog: catalog?.data, legacy: legacy?.data })
  } catch {
    return unavailable()
  }
}

export async function POST(request: Request) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) return forbidden()
    const actor = await shopAdminId(request)
    if (!actor) return forbidden()
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return invalid()
    const db = orderDB()
    if (body.action === 'ship' || body.action === 'deliver') {
      if (!isId(body.unit)) return invalid()
      const shipped = body.action === 'ship'
      const tracking = shipped && body.url ? httpsUrl(body.url) : null
      if (shipped && (!text(body.carrier, 120) || !body.carrier.trim()
        || !text(body.tracking, 120) || (body.url && !tracking))) return invalid()
      const result = await db.rpc('shop_confirm_self_shipping', {
        p_unit: body.unit, p_status: shipped ? 'shipped' : 'delivered', p_actor: actor,
        p_carrier: shipped ? body.carrier.trim() : null, p_tracking_number: shipped ? body.tracking.trim() || null : null,
        p_tracking_url: tracking,
      })
      return result.error ? (result.error.code === '22023' ? conflict() : unavailable()) : reply({ ok: true })
    }

    if (!isSku(body.sku)) return invalid()
    if (body.action === 'stock') {
      if (!Number.isInteger(body.delta) || !body.delta || Math.abs(body.delta) > 1000000
        || !isId(body.requestId) || !text(body.reason, 250) || !body.reason.trim()) return invalid()
      const result = await db.rpc('shop_adjust_inventory', {
        p_sku: body.sku, p_delta: body.delta, p_request: body.requestId, p_actor: actor, p_reason: body.reason.trim(),
      })
      return result.error
        ? (['23505', '23514', '22023', '22003'].includes(result.error.code) ? conflict() : unavailable())
        : reply({ product: result.data })
    }

    if (body.action !== 'create' && body.action !== 'edit') return invalid()
    if (!text(body.name, 160) || !body.name.trim() || !text(body.description, 10000)
      || !text(body.category, 120) || !text(body.collection, 120)
      || !oneOf(body.status, productStatuses) || !oneOf(body.product_world, productWorlds)
      || !oneOf(body.fulfillment_type, fulfillmentTypes)
      || (body.price_cents !== null && !money(body.price_cents))
      || (body.status === 'active' && body.price_cents === null)
      || !Array.isArray(body.image_urls) || body.image_urls.length > maxProductImages) return invalid()
    const images = (body.image_urls as unknown[]).map(httpsUrl)
    if (images.some(url => {
      if (!url) return true
      const path = managedImagePath(url)
      return path !== null && !path.startsWith(body.sku + '/')
    })) return invalid()
    let shippingConfig
    if ('shipping_config' in body) {
      try {
        shippingConfig = readShippingConfig(body.shipping_config)
      } catch (error) {
        return reply({ error: error instanceof Error ? error.message : 'Ungültige Versandkonfiguration.' }, 400)
      }
      if (shippingConfig?.rateCodes.length) {
        const rates = await db.from('shop_shipping_rates').select('code,mode,partner').in('code', shippingConfig.rateCodes)
        if (rates.error) return unavailable()
        const compatible = rates.data.filter(rate => body.fulfillment_type === 'self'
          ? rate.mode === 'self' : rate.mode === 'partner' && rate.partner === body.fulfillment_type)
        if (compatible.length !== shippingConfig.rateCodes.length) {
          return reply({ error: 'Mindestens eine Versandart fehlt oder passt nicht zum Fulfillment.' }, 400)
        }
      }
    }
    const row = {
      name: body.name.trim(), description: body.description.trim(), price_cents: body.price_cents,
      category: body.category.trim(), product_world: body.product_world, collection: body.collection.trim(),
      ...(shippingConfig !== undefined ? { shipping_config: shippingConfig } : {}),
      image_urls: images, status: body.status, fulfillment_type: body.fulfillment_type,
    }
    if (body.action === 'create') {
      const { data: collision, error } = await db.from('shop_catalog_products').select('sku').eq('sku', body.sku).maybeSingle()
      if (error) return unavailable()
      if (collision) return conflict()
      const result = await db.from('shop_merchandise').insert({ sku: body.sku, ...row }).select(fields).single()
      if (result.error) return ['23505', '23503', '23514'].includes(result.error.code) ? conflict() : unavailable()
      return reply({ product: result.data }, 201)
    }
    if (!isId(body.version)) return invalid()
    const result = await db.from('shop_merchandise').update({ ...row, version: crypto.randomUUID() })
      .eq('sku', body.sku).eq('version', body.version).select(fields).maybeSingle()
    if (result.error) return ['23503', '23514'].includes(result.error.code) ? conflict() : unavailable()
    return result.data ? reply({ product: result.data }) : conflict()
  } catch {
    return unavailable()
  }
}
