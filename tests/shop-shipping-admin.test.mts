import assert from 'node:assert/strict'
import test from 'node:test'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://database.example.com'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service'
const { GET, POST } = await import('../app/api/admin/shop/shipping/route')

test('shipping rate administration is protected, validates writes and checks edit versions', async () => {
  const original = globalThis.fetch
  const origin = 'https://shop.example.com'
  const endpoint = origin + '/api/admin/shop/shipping'
  const calls: string[] = []
  let admin = false
  let persisted: Record<string, unknown> | null = null
  const rate = {
    code: 'DHL-TEST', name: 'Paket', carrier: 'DHL', mode: 'self', partner: null, zone: 'Deutschland',
    countries: ['DE'], price_cents: 600, max_length_mm: 500, max_width_mm: 300, max_depth_mm: 200,
    max_weight_g: 2000, tracking: true, delivery_estimate: null, active: false, valid_through: null, version: '',
  }
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    if (url.pathname === '/auth/v1/user') return Response.json({ id: 'admin', aud: 'authenticated' })
    if (url.pathname.endsWith('/admin_users')) return Response.json(admin ? { user_id: 'admin' } : null)
    assert.ok(url.pathname.endsWith('/shop_shipping_rates'))
    calls.push(init?.method ?? 'GET')
    if (init?.method === 'POST') {
      persisted = { ...JSON.parse(String(init.body)), version: crypto.randomUUID() }
    } else if (init?.method === 'PATCH') {
      if (url.searchParams.get('version') !== 'eq.' + persisted?.version) return Response.json([])
      persisted = JSON.parse(String(init.body))
    }
    return Response.json(persisted ? [persisted] : [])
  }
  const request = (body: object, from = origin) => new Request(endpoint, {
    method: 'POST', headers: { Authorization: 'Bearer token', Origin: from }, body: JSON.stringify(body),
  })
  try {
    assert.equal((await GET(new Request(endpoint))).status, 403)
    assert.equal((await POST(request(rate))).status, 403)
    admin = true
    assert.equal((await POST(request(rate, 'https://other.example'))).status, 403)
    assert.equal((await POST(request({ ...rate, active: true, price_cents: null }))).status, 400)
    assert.equal(calls.length, 0)
    const created = await POST(request(rate))
    assert.equal(created.status, 201)
    const stored = (await created.json()).rate
    assert.equal((await POST(request({ ...stored, active: true }))).status, 200)
    assert.equal((await POST(request({ ...stored, active: false }))).status, 409)
    const listed = await GET(new Request(endpoint, { headers: { Authorization: 'Bearer token' } }))
    assert.equal(listed.status, 200)
    assert.match(listed.headers.get('cache-control')!, /no-store/)
    assert.equal((await listed.json()).rates[0].active, true)
  } finally {
    globalThis.fetch = original
  }
})

test('product assignment accepts inactive draft rates but rejects cross-fulfillment assignments', async () => {
  const { POST: saveProduct } = await import('../app/api/admin/shop/products/route')
  const original = globalThis.fetch
  const origin = 'https://shop.example.com'
  const version = crypto.randomUUID()
  const base = {
    action: 'edit', sku: 'UHL-PATCH-001', version, name: 'Patch', description: '', category: '',
    collection: '', product_world: 'league', status: 'draft', fulfillment_type: 'self',
    price_cents: 500, image_urls: [],
  }
  const config = { rateCodes: ['DP-STANDARD-DE'], domesticOnly: true, countries: [], package: null, standardLetterVerified: false }
  const written: Record<string, unknown>[] = []
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    if (url.pathname === '/auth/v1/user') return Response.json({ id: 'admin', aud: 'authenticated' })
    if (url.pathname.endsWith('/admin_users')) return Response.json({ user_id: 'admin' })
    if (url.pathname.endsWith('/shop_shipping_rates')) return Response.json([{ code: 'DP-STANDARD-DE', mode: 'self', partner: null }])
    assert.ok(url.pathname.endsWith('/shop_merchandise'))
    assert.equal(init?.method, 'PATCH')
    const row = JSON.parse(String(init.body))
    written.push(row)
    return Response.json([row])
  }
  const submit = (data: object) => saveProduct(new Request(origin + '/api/admin/shop/products', {
    method: 'POST', headers: { Authorization: 'Bearer token', Origin: origin }, body: JSON.stringify(data),
  }))
  try {
    assert.equal((await submit({ ...base, fulfillment_type: 'gelato', shipping_config: config })).status, 400)
    assert.equal((await submit({ ...base, shipping_config: { ...config, rateCodes: ['UNKNOWN'], standardLetterVerified: true } })).status, 400)
    assert.equal(written.length, 0)
    assert.equal((await submit({ ...base, shipping_config: config })).status, 200)
    assert.deepEqual(written[0].shipping_config, config)
    assert.equal((await submit(base)).status, 200)
    assert.equal('shipping_config' in written[1], false)
  } finally {
    globalThis.fetch = original
  }
})
