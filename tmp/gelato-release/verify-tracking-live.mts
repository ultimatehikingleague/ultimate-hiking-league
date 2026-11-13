import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parseEnv } from 'node:util'
import { createClient } from '@supabase/supabase-js'

const env = parseEnv(fs.readFileSync('.env.local', 'utf8'))
const database = 'https://astdepkrdkmufsydxviz.supabase.co'
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, database)
assert.ok(env.SUPABASE_SERVICE_ROLE_KEY && env.GELATO_API_KEY)
for (const key of ['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','GELATO_API_KEY'] as const) process.env[key] = env[key]
const { processStatusSync, adminTracking } = await import('../../app/lib/shop/status-sync')
const db = createClient(database, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const { data, error } = await db.from('shop_fulfillment').select('order_id')
  .eq('mode','live').eq('status','submitted').not('gelato_order_id','is',null).limit(2)
assert.ok(!error, error?.code)
assert.equal(data?.length, 1, 'Expected exactly one existing submitted LIVE order')
const orderId = data![0].order_id
const { data: queued, error: refreshError } = await db.rpc('shop_tracking_refresh', { p_order_id: orderId })
assert.ok(!refreshError, refreshError?.code)
assert.equal(queued, true)
const original = globalThis.fetch
const calls: Record<string, number> = {}
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input))
  const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
  if (url.hostname === 'order.gelatoapis.com') {
    assert.equal(method,'GET')
    assert.match(url.pathname,/^\/v4\/orders\/[^/]+$/)
    calls.gelatoGet = (calls.gelatoGet ?? 0) + 1
  } else {
    assert.equal(url.origin, database)
    assert.ok(['/rest/v1/rpc/shop_tracking_claim','/rest/v1/rpc/shop_tracking_apply','/rest/v1/rpc/shop_tracking_link','/rest/v1/shop_fulfillment_units'].includes(url.pathname), 'Unexpected status worker route')
    calls.supabase = (calls.supabase ?? 0) + 1
  }
  return original(input, init)
}
let run
try { run = await processStatusSync(1, orderId) }
finally { globalThis.fetch = original }
assert.equal(run.processed, 1)
const view = await adminTracking(orderId)
assert.ok(view.available && view.units.length)
const units = view.units.map(unit => ({
  status:unit.raw_status, production:unit.production_status, shipping:unit.shipping_status, delivery:unit.delivery_status,
  lastSuccess:unit.last_success_at,
  packages:unit.shop_fulfillment_shipments.length,
  trackingPresent:unit.shop_fulfillment_shipments.some(p=>Boolean(p.tracking_number || p.tracking_url)),
  nextAttempt:(Array.isArray(unit.shop_fulfillment_sync)?unit.shop_fulfillment_sync[0]:unit.shop_fulfillment_sync)?.next_attempt_at,
}))
const result = { checkedAt:new Date().toISOString(), processed:run.processed, calls, units }
console.log(JSON.stringify(result))
fs.writeFileSync('tmp/gelato-release/live-status-result.json',JSON.stringify(result,null,2)+'\n')
