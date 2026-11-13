import { loadEnvConfig } from '@next/env'
import { mkdirSync, openSync, closeSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getOrder } from '../app/lib/shop/orders'
import { buildTestDraft, gelatoDraftRequest } from '../app/lib/shop/gelato-draft'
loadEnvConfig(process.cwd())
async function main() {
  const id = process.argv[2]
  if (!id || !/^[a-f0-9-]{36}$/.test(id) || process.argv[3] !== '--create-draft') throw new Error('Usage: node --import tsx scripts/gelato-test-draft.ts ORDER_ID --create-draft')
  const order = await getOrder(id)
  if (!order) throw new Error('Test order missing')
  const payload = buildTestDraft(order)
  const directory = resolve('.shop-private/gelato'); mkdirSync(directory, { recursive: true, mode: 0o700 })
  const receipt = resolve(directory, `${id}.json`), lock = resolve(directory, `${id}.lock`)
  if (existsSync(receipt)) { const saved = JSON.parse(readFileSync(receipt, 'utf8')); console.log(JSON.stringify({ alreadyRecorded: true, ...saved })); return }
  const fd = openSync(lock, 'wx', 0o600); closeSync(fd)
  // Keep the lock after failures: a timed-out create may have succeeded remotely.
  // Inspect/search first; never automatically retry a create request.
  const search = await gelatoDraftRequest('orders:search', { orderReferenceId: payload.orderReferenceId, limit: 100 })
  if (!Array.isArray(search.orders)) throw new Error('Unexpected search response')
  const matches = search.orders.filter((o: { orderReferenceId: string }) => o.orderReferenceId === payload.orderReferenceId)
  if (matches.length > 1) throw new Error('Duplicate references; manual review required')
  const draft = matches.length ? await gelatoDraftRequest(`orders/${encodeURIComponent(matches[0].id)}`) : await gelatoDraftRequest('orders', payload)
  if (draft.orderType !== 'draft' || typeof draft.id !== 'string' || draft.orderReferenceId !== payload.orderReferenceId) throw new Error('Unexpected draft response; manual review required')
  const result = { shopOrderId: id, gelatoOrderId: draft.id, reference: draft.orderReferenceId, orderType: draft.orderType, financialStatus: draft.financialStatus, fulfillmentStatus: draft.fulfillmentStatus, fileSha256: order.file_sha256, createdAt: new Date().toISOString() }
  writeFileSync(receipt, JSON.stringify(result, null, 2) + '\n', { mode: 0o600 })
  console.log(JSON.stringify(result))
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Draft workflow failed'); process.exitCode = 1 })
