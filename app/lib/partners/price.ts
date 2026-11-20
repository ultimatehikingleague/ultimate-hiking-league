export function parseBookingPrice(value: string): number | null {
  const amount = value.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) return null
  const [euros, fraction = ''] = amount.split('.')
  const cents = Number(euros) * 100 + Number(fraction.padEnd(2, '0'))
  return cents <= 2_147_483_647 ? cents : null
}

export function bookingPriceInput(cents: number | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',')
}
