import { orderDB, type ShopOrder } from './orders'
import { paymentMode } from './config'
import { reconcilePayPal } from './paypal'
import { reconcileStripe } from './stripe'
import { releaseVoucherOrder } from './vouchers'

export async function reconcileExpiredVoucherOrders() {
  const db = orderDB()
  const now = new Date().toISOString()
  const { data, error } = await db.from('shop_orders').select('*')
    .eq('mode', paymentMode()).eq('status', 'pending').not('voucher_code', 'is', null)
    .lte('voucher_expires_at', now).order('voucher_checked_at', { nullsFirst: true })
    .order('voucher_expires_at').limit(6)
  if (error) throw new Error('Voucher expiration lookup failed')
  const results = await Promise.allSettled((data as ShopOrder[]).map(async order => {
    const { error: updateError } = await db.from('shop_orders').update({ voucher_checked_at: now }).eq('id', order.id)
    if (updateError) throw new Error('Voucher expiration bookkeeping failed')
    if (order.provider === 'stripe' && order.provider_order_id) {
      await reconcileStripe(order.provider_order_id)
    } else if (order.provider === 'paypal' && order.provider_order_id && order.voucher_capture_started) {
      await reconcilePayPal(order, true)
    } else {
      await releaseVoucherOrder(order.id, false)
    }
  }))
  return results.every(result => result.status === 'fulfilled')
}
