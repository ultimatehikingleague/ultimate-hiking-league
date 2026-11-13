import { requireShopAdmin } from '../../../../lib/requireShopAdmin'
import { orderDB } from '../../../../lib/shop/orders'
import { readShippingRate } from '../../../../lib/shop/shipping-config'

const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization' }
const reply = (data: unknown, status = 200) => Response.json(data, { headers, status })
const denied = () => reply({ error: 'Zugriff verweigert.' }, 403)
const unavailable = () => reply({ error: 'Versandverwaltung derzeit nicht verfügbar.' }, 503)

export async function GET(request: Request) {
  try {
    if (!await requireShopAdmin(request)) return denied()
    const { data, error } = await orderDB().from('shop_shipping_rates').select('*').order('code')
    if (error) return unavailable()
    return reply({ rates: data })
  } catch {
    return unavailable()
  }
}

export async function POST(request: Request) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin || !await requireShopAdmin(request)) return denied()
    let rate
    try {
      rate = readShippingRate(await request.json())
    } catch (error) {
      return reply({ error: error instanceof Error ? error.message : 'Ungültige Versandart.' }, 400)
    }
    const db = orderDB()
    const { version, ...fields } = rate
    const query = version
      ? db.from('shop_shipping_rates').update({ ...fields, version: crypto.randomUUID() }).eq('code', rate.code).eq('version', version)
      : db.from('shop_shipping_rates').insert(fields)
    const { data, error } = await query.select('*').maybeSingle()
    if (error && !['23505', '23514'].includes(error.code)) return unavailable()
    return data
      ? reply({ rate: data }, version ? 200 : 201)
      : reply({ error: 'Konflikt mit gespeicherten Daten. Bitte die Liste neu laden und erneut prüfen.' }, 409)
  } catch {
    return unavailable()
  }
}
