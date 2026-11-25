import { orderDB } from './orders'
import { CheckoutError } from './validation'

export function voucherCode(value: unknown) {
  if (value === undefined || value === '') return undefined
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9_-]{2,39}$/i.test(value.trim())) {
    throw new CheckoutError('Bitte einen gültigen Gutscheincode eingeben.')
  }
  return value.trim().toUpperCase()
}

export function voucherError(error: { code: string; message: string }): never {
  if (error.code === 'P0001' && error.message === 'voucher_unavailable') {
    throw new CheckoutError('Dieser Gutschein ist für diese Bestellung nicht verfügbar.', 409)
  }
  throw new Error('Voucher database unavailable')
}

export async function voucherDiscount(code: string, sku: string, subtotal: number, mode: string) {
  const { data, error } = await orderDB().rpc('shop_voucher_discount', {
    p_code: code, p_sku: sku, p_subtotal: subtotal, p_mode: mode,
  })
  if (error) voucherError(error)
  return data as number
}

export async function releaseVoucherOrder(id: string, providerFinal: boolean) {
  const { error } = await orderDB().rpc('shop_release_voucher_order', {
    p_order_id: id, p_provider_final: providerFinal,
  })
  if (error) throw new Error('Voucher release failed')
}
