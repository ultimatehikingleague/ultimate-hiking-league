import { createClient } from '@supabase/supabase-js'
import { required } from './config'
import type { Address } from './validation'
export type ShopOrder = { id: string; sku?: string; product_name?: string; access_token_hash: string; provider: 'stripe' | 'paypal'; mode: 'test' | 'live'; quantity: number; unit_price_cents: number; shipping_cents: number; total_cents: number; currency: string; address: Address; shipping_method_uid: string; provider_order_id: string | null; status: string; paid_at?: string; file_url: string; file_sha256: string; product_uid: string; page_count: number; created_at?: string }
export function orderDB() { return createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } }) }
export async function getOrder(id: string) {
  const { data, error } = await orderDB().from('shop_orders').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error('Order database unavailable')
  return data as ShopOrder | null
}
export async function markPaid(order: ShopOrder, paymentId: string, amountCents: number, currency: string, providerOrderId: string) {
  if (amountCents !== order.total_cents || currency.toUpperCase() !== order.currency || providerOrderId !== order.provider_order_id) throw new Error('Payment does not match order')
  const { error } = await orderDB().rpc('shop_record_payment', { p_order_id: order.id, p_provider: order.provider, p_mode: order.mode, p_payment_id: paymentId, p_amount_cents: amountCents, p_currency: currency.toUpperCase(), p_provider_order_id: providerOrderId })
  if (error) throw new Error('Payment persistence failed')
  // Production is deliberately a separate, audited step. Never create a Gelato order here.
}
