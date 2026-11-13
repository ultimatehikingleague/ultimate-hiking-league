import { buildTestDraft, gelatoDraftRequest } from './gelato-draft'
import { getOrder, orderDB, type ShopOrder } from './orders'
export type FulfillmentJob = { order_id: string; mode: string; claim_token: string }
export async function transferTestDraft(order: ShopOrder) {
  const payload = buildTestDraft(order)
  const search = await gelatoDraftRequest('orders:search', { orderReferenceId: payload.orderReferenceId, limit: 100 })
  if (!Array.isArray(search.orders)) throw new Error('Invalid Gelato search response')
  const matches = search.orders.filter((entry: { orderReferenceId: string }) => entry.orderReferenceId === payload.orderReferenceId)
  if (matches.length > 1) throw new Error('Duplicate Gelato references')
  // POST create is never retried automatically. Ambiguous failures require review.
  const draft = matches.length ? await gelatoDraftRequest(`orders/${encodeURIComponent(matches[0].id)}`) : await gelatoDraftRequest('orders', payload)
  if (draft.orderType !== 'draft' || draft.orderReferenceId !== payload.orderReferenceId || typeof draft.id !== 'string') throw new Error('Unexpected Gelato result')
  return draft.id as string
}
export async function processNextTestFulfillment() {
  const db = orderDB()
  const { data, error } = await db.rpc('shop_claim_test_fulfillment')
  if (error) throw new Error('Fulfillment queue is not available')
  const job = (data as FulfillmentJob[] | null)?.[0]
  if (!job) return null
  try {
    if (job.mode !== 'test') throw new Error('Live fulfillment is not enabled')
    const order = await getOrder(job.order_id)
    if (!order) throw new Error('Order missing')
    const gelatoId = await transferTestDraft(order)
    const { data: saved, error: saveError } = await db.from('shop_fulfillment').update({ status: 'draft', gelato_order_id: gelatoId, completed_at: new Date().toISOString(), last_error: null }).eq('order_id', job.order_id).eq('claim_token', job.claim_token).eq('status', 'processing').select('order_id')
    if (saveError || saved?.length !== 1) throw new Error('Draft association not persisted')
    return { orderId: job.order_id, status: 'draft', gelatoId }
  } catch {
    const { error: reviewError } = await db.from('shop_fulfillment').update({ status: 'review', last_error: 'Transfer needs reconciliation with Gelato; do not retry creation blindly' }).eq('order_id', job.order_id).eq('claim_token', job.claim_token).eq('status', 'processing')
    if (reviewError) throw new Error('Transfer interrupted; queue needs review')
    return { orderId: job.order_id, status: 'review' }
  }
}

// Hosted worker: claims and frozen print snapshots prevent duplicate production.
export async function processNextHostedFulfillment() {
  const { paymentMode, required } = await import('./config')
  const mode = paymentMode()
  if (mode === 'live' && (process.env.SHOP_LIVE_APPROVED !== 'true' || process.env.SHOP_FULFILLMENT_ENABLED !== 'true')) return null
  if (process.env.SHOP_FULFILLMENT_ENABLED !== 'true') return null
  required('GELATO_API_KEY')
  const db = orderDB(), { data, error } = await db.rpc('shop_claim_fulfillment', { p_mode: mode })
  if (error) throw new Error('Hosted fulfillment queue unavailable')
  const job = (data as FulfillmentJob[] | null)?.[0]
  if (!job) return null
  try {
    const order = await getOrder(job.order_id)
    if (!order || order.status !== 'paid' || order.mode !== mode || job.mode !== mode) throw new Error('Paid order mismatch')
    let gelatoId: string
    if (mode === 'test') gelatoId = await transferTestDraft(order)
    else {
      const { buildLiveOrder } = await import('./gelato-draft')
      const payload = buildLiveOrder(order)
      const search = await gelatoDraftRequest('orders:search', { orderReferenceId: payload.orderReferenceId, limit: 100 })
      if (!Array.isArray(search.orders)) throw new Error('Invalid search response')
      const matches = search.orders.filter((entry: { orderReferenceId: string }) => entry.orderReferenceId === payload.orderReferenceId)
      if (matches.length > 1) throw new Error('Duplicate supplier references')
      const remote = matches.length ? await gelatoDraftRequest(`orders/${encodeURIComponent(matches[0].id)}`) : await gelatoDraftRequest('orders', payload)
      if (remote.orderType !== 'order' || remote.orderReferenceId !== payload.orderReferenceId || typeof remote.id !== 'string') throw new Error('Unexpected supplier result')
      gelatoId = remote.id
    }
    const status = mode === 'test' ? 'draft' : 'submitted'
    const saved = await db.from('shop_fulfillment').update({ status, gelato_order_id: gelatoId, completed_at: new Date().toISOString(), last_error: null }).eq('order_id', job.order_id).eq('claim_token', job.claim_token).eq('status', 'processing').select('order_id')
    if (saved.error || saved.data?.length !== 1) throw new Error('Supplier association not persisted')
    return { orderId: order.id, status }
  } catch {
    const reviewed = await db.from('shop_fulfillment').update({ status: 'review', last_error: 'Transfer needs reconciliation; never retry creation blindly' }).eq('order_id', job.order_id).eq('claim_token', job.claim_token).eq('status', 'processing')
    if (reviewed.error) throw new Error('Queue reconciliation required')
    return { orderId: job.order_id, status: 'review' }
  }
}
