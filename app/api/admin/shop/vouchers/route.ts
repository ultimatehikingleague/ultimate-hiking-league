import { randomBytes } from 'node:crypto'
import { shopAdminId } from '../../../../lib/requireShopAdmin'
import { jsonBody, errorResponse } from '../../../../lib/shop/http'
import { orderDB } from '../../../../lib/shop/orders'
import { paymentMode } from '../../../../lib/shop/config'
import { CheckoutError } from '../../../../lib/shop/validation'
import { voucherCode } from '../../../../lib/shop/vouchers'
import { merchandiseSku } from '../../../../lib/shop/merchandise'

const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization' }
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers })
const unavailable = () => reply({ error: 'Gutscheinverwaltung vorübergehend nicht verfügbar.' }, 503)
const integer = (value: unknown, min: number, max: number) =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
const date = (value: unknown) => value === null ||
  (typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value)))

export async function GET(request: Request) {
  try {
    if (!await shopAdminId(request)) return reply({ error: 'Zugriff verweigert.' }, 403)
    const params = new URL(request.url).searchParams
    const code = voucherCode(params.get('code') ?? undefined)
    const after = params.get('after') || ''
    const mode = paymentMode()
    const db = orderDB()
    if (code) {
      const offset = Number(after)
      if (!integer(offset, 0, 1000000)) return reply({ error: 'Ungültiger Verlauf.' }, 400)
      const { data, error } = await db.from('shop_orders')
        .select('id,mode,status,discount_cents,created_at,paid_at,voucher_expires_at')
        .eq('voucher_code', code).eq('mode', mode).order('created_at', { ascending: false }).order('id')
        .range(offset, offset + 50)
      return error ? unavailable() : reply({ history: data.slice(0, 50), next: data.length > 50 ? String(offset + 50) : null })
    }
    if (after && !voucherCode(after)) return reply({ error: 'Ungültige Seite.' }, 400)
    const [vouchers, products] = await Promise.all([
      db.rpc('shop_admin_voucher_list', { p_after: after, p_mode: mode }),
      after ? null : db.from('shop_catalog_products').select('sku,name,active').order('name'),
    ])
    if (vouchers.error || products?.error) return unavailable()
    return reply({
      vouchers: vouchers.data.slice(0, 100),
      products: products?.data,
      next: vouchers.data.length > 100 ? vouchers.data[99].code : null,
      mode,
    })
  } catch (error) {
    return error instanceof CheckoutError ? errorResponse(error) : unavailable()
  }
}

export async function POST(request: Request) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin || !await shopAdminId(request)) {
      return reply({ error: 'Zugriff verweigert.' }, 403)
    }
    const body = await jsonBody(request)
    if (!body || typeof body !== 'object') return reply({ error: 'Ungültige Eingaben.' }, 400)
    const mode = paymentMode()
    const db = orderDB()
    if (body.action === 'activate') {
      const code = voucherCode(body.code)
      if (!code || typeof body.active !== 'boolean') return reply({ error: 'Ungültige Eingaben.' }, 400)
      const { data, error } = await db.from('shop_vouchers').update({ active: body.active }).eq('code', code).eq('mode', mode).select('code').maybeSingle()
      return error ? unavailable() : data ? reply({ code }) : reply({ error: 'Gutschein nicht gefunden.' }, 404)
    }
    const { kind, value, sku, startsAt, endsAt, minimumCents, usageLimit, count } = body
    const customCode = voucherCode(body.code)
    if (body.action !== 'create' || !['percent', 'fixed'].includes(kind)
      || !integer(value, 1, kind === 'percent' ? 100 : 2147483647)
      || !integer(minimumCents, 0, 2147483647)
      || (usageLimit !== null && !integer(usageLimit, 1, 2147483647))
      || !integer(count, 1, 250) || (count !== 1 && customCode)
      || (sku !== null && (typeof sku !== 'string' || !merchandiseSku.test(sku)))
      || !date(startsAt) || !date(endsAt) || (startsAt && endsAt && Date.parse(startsAt) >= Date.parse(endsAt))) {
      return reply({ error: 'Bitte überprüfe Gutscheinwert, Gültigkeit und Nutzungslimit.' }, 400)
    }
    const vouchers = Array.from({ length: count }, () => ({
      code: customCode ?? randomBytes(12).toString('hex').toUpperCase(),
      mode, kind, value, sku, starts_at: startsAt, ends_at: endsAt, minimum_cents: minimumCents, usage_limit: usageLimit,
    }))
    const { error } = await db.from('shop_vouchers').insert(vouchers)
    if (error?.code === '23505') return reply({ error: 'Ein Gutscheincode existiert bereits.' }, 409)
    if (error?.code === '23503') return reply({ error: 'Dieses Produkt existiert nicht.' }, 400)
    return error ? unavailable() : reply({ created: vouchers.map(voucher => voucher.code) }, 201)
  } catch (error) {
    return error instanceof CheckoutError ? errorResponse(error) : unavailable()
  }
}
