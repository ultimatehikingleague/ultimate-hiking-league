import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://database.example.com'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service'
const { GET, POST } = await import('../app/api/admin/shop/products/route')
const actor = 'a7382e21-fd0d-4b55-8815-74a854b4df0d'
const origin = 'https://shop.example.com'
const endpoint = origin + '/api/admin/shop/products'

test('merchandise and shipment operations require verified admin access and use the verified actor', async () => {
  const original = globalThis.fetch
  const calls: string[] = []
  let admin = false
  const id = 'a241e041-2c1e-42ae-8c84-17330b4c82fb'
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    calls.push(url.pathname)
    if (url.pathname === '/auth/v1/user') return Response.json({ id: actor, aud: 'authenticated' })
    if (url.pathname.endsWith('/admin_users')) return Response.json(admin ? { user_id: actor } : null)
    if (url.pathname.endsWith('/rpc/shop_confirm_self_shipping')) {
      const params = JSON.parse(String(init?.body))
      assert.equal(params.p_actor, actor)
      assert.equal(params.p_unit, id)
      assert.equal(params.p_status, 'shipped')
      assert.equal(params.p_tracking_url, 'https://carrier.example/123')
      return Response.json(null)
    }
    throw Error('Unexpected DB request')
  }
  try {
    const post = (body: object, from = origin) => POST(new Request(endpoint, {
      method: 'POST', headers: { Origin: from, Authorization: 'Bearer token' }, body: JSON.stringify(body),
    }))
    assert.equal((await GET(new Request(endpoint))).status, 403)
    assert.equal((await post({ action: 'deliver', unit: id }, 'https://other.example')).status, 403)
    assert.equal(calls.length, 0)
    assert.equal((await post({ action: 'deliver', unit: id })).status, 403)
    assert.deepEqual(calls, ['/auth/v1/user', '/rest/v1/admin_users'])
    admin = true
    const shipment = { action: 'ship', unit: id, carrier: 'DHL', tracking: '123', actor: 'forged' }
    const invalid = await post({ ...shipment, url: 'https://user@carrier.example/123' })
    assert.equal(invalid.status, 400)
    assert.equal(calls.some(call => call.includes('/rpc/')), false)
    const shipped = await post({ ...shipment, url: 'https://carrier.example/123' })
    assert.equal(shipped.status, 200)
    assert.match(shipped.headers.get('cache-control')!, /no-store/)
  } finally {
    globalThis.fetch = original
  }
})
