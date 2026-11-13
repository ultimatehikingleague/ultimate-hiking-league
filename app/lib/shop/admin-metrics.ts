import { orderDB } from './orders'
import { berlinBoundary } from './admin-orders'

type FulfillmentUnit = {
 mode: string
 production_status: string
 shipping_status: string
 delivery_status: string
 shop_fulfillment_unit_lines: { order_line_id: string; quantity: number }[]
}
type Order = {
 mode: string
 status: string
 paid_at: string | null
 total_cents: number
 shop_fulfillment: { status: string } | null
 shop_order_lines: { id: string; quantity: number }[]
 shop_fulfillment_units: FulfillmentUnit[]
}
type PaymentRecord = {
 order_id: string; amount_cents: number; currency: string; mode: string
 shop_orders: Order
}

function fulfillmentState(order: Order): 'open' | 'closed' | 'unknown' {
 const units = order.shop_fulfillment_units.filter(unit => unit.mode === 'live')
 if (!units.length && ['pending', 'processing', 'draft'].includes(order.shop_fulfillment?.status ?? '')) return 'open'

 const remaining = new Map(order.shop_order_lines.map(line => [line.id, line.quantity]))
 let allClosed = units.length > 0 && remaining.size > 0
 for (const unit of units) {
  const lines = unit.shop_fulfillment_unit_lines
  const mapped = lines.length > 0 && lines.every(line => remaining.has(line.order_line_id) && line.quantity > 0)
  const closed = ['delivered', 'returned'].includes(unit.delivery_status) || unit.shipping_status === 'returned'
  const open = !closed && (
   ['ready', 'shipped', 'in_transit'].includes(unit.shipping_status)
   || ['not_started', 'in_production', 'printed', 'on_hold'].includes(unit.production_status)
  )
  if (mapped && open) return 'open'
  if (!mapped || !closed) allClosed = false
  for (const line of lines) {
   const left = remaining.get(line.order_line_id)
   if (left !== undefined) remaining.set(line.order_line_id, left - line.quantity)
  }
 }
 if (allClosed && [...remaining.values()].every(quantity => quantity === 0)) return 'closed'
 return 'unknown'
}

export function calculateMetrics(records: PaymentRecord[], now = new Date()) {
 const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
 const start = Date.parse(berlinBoundary(day)), end = Date.parse(berlinBoundary(day, true))
 let paidToday = 0, revenueCents = 0, knownOpen = 0, unknownFulfillment = 0, refundedRecords = 0
 const seen = new Set<string>()
 for (const payment of records) {
  const order = payment.shop_orders
  if (payment.mode !== 'live' || order.mode !== 'live') continue
  if (order.status === 'refunded') { refundedRecords++; continue }
  if (order.status !== 'paid') continue
  if (payment.currency !== 'EUR' || payment.amount_cents !== order.total_cents || seen.has(payment.order_id)) throw Error('Inconsistent confirmed payment data')
  seen.add(payment.order_id)
  revenueCents += payment.amount_cents
  const paidAt = order.paid_at ? Date.parse(order.paid_at) : NaN
  if (paidAt >= start && paidAt < end) paidToday++
  const state = fulfillmentState(order)
  if (state === 'open') knownOpen++
  if (state === 'unknown') unknownFulfillment++
 }
 return { paidToday, revenueCents, openOrders: unknownFulfillment ? null : knownOpen, knownOpen, unknownFulfillment, refundedRecords, checkedAt: now.toISOString() }
}

export type AdminMetrics = ReturnType<typeof calculateMetrics>

export async function getAdminMetrics() {
 const db = orderDB(), records: PaymentRecord[] = []
 // Paginate explicitly; never silently calculate totals using Supabase's first 1000 rows only.
 for (let offset = 0; ; offset += 500) {
  const { data, error } = await db.from('shop_payments')
   .select('order_id,amount_cents,currency,mode,shop_orders!inner(mode,status,paid_at,total_cents,shop_fulfillment(status),shop_order_lines(id,quantity),shop_fulfillment_units(mode,production_status,shipping_status,delivery_status,shop_fulfillment_unit_lines(order_line_id,quantity)))')
   .eq('mode', 'live').eq('shop_orders.mode', 'live').in('shop_orders.status', ['paid', 'refunded'])
   .order('order_id').range(offset, offset + 499)
   .overrideTypes<PaymentRecord[], { merge: false }>()
  if (error) throw Error('Dashboard data unavailable')
  records.push(...data)
  if (data.length < 500) break
 }
 return calculateMetrics(records)
}
