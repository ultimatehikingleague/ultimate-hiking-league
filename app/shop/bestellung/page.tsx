import OrderStatus from './OrderStatus'
export const metadata = { title: 'Deine Bestellung | ULTIMATE', robots: { index: false, follow: false }, referrer: 'no-referrer' as const }
export default function OrderPage() { return <OrderStatus /> }
