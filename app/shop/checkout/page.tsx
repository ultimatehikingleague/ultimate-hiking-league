import Link from 'next/link'
import { checkoutEnabled } from '../../lib/shop/config'
import CheckoutForm from './CheckoutForm'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Kalender bestellen | ULTIMATE OUTDOOR STORE', robots: { index: false, follow: false } }
export default function CheckoutPage() {
  return <main className="min-h-screen bg-[#141312] px-5 py-12 text-stone-100"><div className="mx-auto max-w-6xl">
    <Link className="text-sm text-stone-300 underline" href="/shop/schorschys-wanderkalender-2027">Zurück zum Kalender</Link>
    <p className="mt-8 text-sm tracking-widest text-emerald-300">ULTIMATE OUTDOOR STORE</p><h1 className="mt-3 text-3xl font-bold">Dein nächstes Abenteuer beginnt hier.</h1>
    <div className="mt-8 grid items-start overflow-hidden rounded-2xl bg-[#f8f6f0] text-[#242b24] shadow-2xl lg:grid-cols-[320px_1fr]">
      <aside className="bg-[#e9e5dc] p-8 lg:sticky lg:top-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/shop/wanderkalender-2027/cover-final.webp" alt="Schorschys Wanderkalender 2027" className="mx-auto w-full max-w-56 shadow-xl" />
        <p className="mt-8 text-xs font-semibold uppercase tracking-widest text-[#527052]">ULTIMATE COLLECTION · 2027</p>
        <h2 className="mt-3 text-2xl font-bold">Schorschy&apos;s Wanderkalender 2027</h2>
        <p className="mt-3 text-sm text-stone-600">12 Monate. 12 Abenteuer. A3-Hochformat.</p>
        <p className="mt-6 text-3xl font-bold">29,90 €</p>
        <p className="mt-2 text-sm text-stone-600">pro Kalender, zuzüglich Versand</p>
        <p className="mt-5 border-t border-stone-400/30 pt-5 text-xs leading-6 text-stone-600">Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.</p>
      </aside>
      <div className="p-5 sm:p-8">{checkoutEnabled() ? <CheckoutForm /> : <div className="rounded-xl border border-stone-300 bg-white p-6"><h2 className="text-xl font-semibold">Bald geht&apos;s los.</h2><p className="mt-3 text-stone-600">Der Verkauf startet in Kürze. Bitte schau bald wieder vorbei.</p></div>}</div>
    </div>
  </div></main>
}
