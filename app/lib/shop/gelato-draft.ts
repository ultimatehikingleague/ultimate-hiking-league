import { CALENDAR, required } from './config'
import type { ShopOrder } from './orders'
import { parseAddress, parseQuantity } from './validation'
export function buildTestDraft(order: ShopOrder) {
  if (order.mode !== 'test' || order.status !== 'paid') throw new Error('Only paid test orders may enter this draft workflow')
  if (order.currency !== 'EUR' || order.product_uid !== CALENDAR.productUid || order.file_url !== CALENDAR.fileUrl || order.file_sha256 !== CALENDAR.fileSha256 || order.page_count !== CALENDAR.pageCount) throw new Error('Calendar print snapshot mismatch')
  if (!order.shipping_method_uid) throw new Error('Shipping method missing')
  return {
    orderType: 'draft' as const,
    orderReferenceId: `ultimate-test-${order.id}`,
    customerReferenceId: `test-${order.id}`,
    currency: 'EUR', shipmentMethodUid: order.shipping_method_uid,
    shippingAddress: parseAddress(order.address),
    items: [{ itemReferenceId: CALENDAR.id, productUid: order.product_uid, quantity: parseQuantity(order.quantity), pageCount: order.page_count, files: [{ type: 'default', url: order.file_url }] }],
    metadata: [{ key: 'purpose', value: 'ULTIMATE sandbox payment / print preview only' }, { key: 'printSha256', value: order.file_sha256 }],
  }
}
export async function gelatoDraftRequest(endpoint: string, body?: unknown) {
  const response = await fetch(`https://order.gelatoapis.com/v4/${endpoint}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'X-API-KEY': required('GELATO_API_KEY'), Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'ULTIMATE-Draft/1.0' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60000), cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Gelato draft request HTTP ${response.status}; inspect before retrying`)
  return response.json()
}

export function buildLiveOrder(order: ShopOrder) {
  if (process.env.SHOP_LIVE_APPROVED !== 'true' || process.env.SHOP_FULFILLMENT_ENABLED !== 'true' || order.mode !== 'live' || order.status !== 'paid') throw new Error('Live production is not approved')
  // Reuse the same immutable, approved calendar snapshot checks as the draft path.
  const draft = buildTestDraft({ ...order, mode: 'test' })
  return { ...draft, orderType: 'order' as const, orderReferenceId: `ultimate-live-${order.id}`, customerReferenceId: order.id,
    metadata: [{ key: 'purpose', value: 'ULTIMATE paid customer order' }, { key: 'printSha256', value: order.file_sha256 }] }
}
