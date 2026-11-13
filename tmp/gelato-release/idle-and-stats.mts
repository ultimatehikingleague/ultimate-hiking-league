import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parseEnv } from 'node:util'
const env = parseEnv(fs.readFileSync('.env.local', 'utf8'))
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL,'https://astdepkrdkmufsydxviz.supabase.co')
assert.ok(env.SUPABASE_SERVICE_ROLE_KEY)
process.env.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const { processStatusSync } = await import('../../app/lib/shop/status-sync')
const original = globalThis.fetch
let claims = 0
globalThis.fetch = async (input,init) => {
  const url = new URL(input instanceof Request ? input.url : String(input))
  assert.equal(url.href, env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/rpc/shop_tracking_claim')
  claims++
  return original(input,init)
}
let result
try { result = await processStatusSync() } finally { globalThis.fetch = original }
assert.deepEqual(result,{processed:0})
assert.equal(claims,1)
console.log(JSON.stringify({claims,processed:result.processed,gelatoRequests:0}))
