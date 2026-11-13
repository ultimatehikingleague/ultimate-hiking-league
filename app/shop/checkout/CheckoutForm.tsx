'use client'
import { FormEvent, useState } from 'react'
import Link from 'next/link'
type Method = { uid: string; name: string; shippingCents: number; minDays: number; maxDays: number }
const euro = (cents: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
const fields = [ ['firstName', 'Vorname', 'given-name', 25], ['lastName', 'Nachname', 'family-name', 25], ['addressLine1', 'Straße und Hausnummer', 'address-line1', 35], ['addressLine2', 'Adresszusatz (optional)', 'address-line2', 35], ['postCode', 'Postleitzahl', 'postal-code', 15], ['city', 'Ort', 'address-level2', 30], ['email', 'E-Mail-Adresse', 'email', 254], ['phone', 'Telefon (optional)', 'tel', 25] ] as const
export default function CheckoutForm() {
  const [quote, setQuote] = useState<{ token: string; methods: Method[]; quantity: number; unitPriceCents: number } | null>(null)
  const [methodUid, setMethodUid] = useState(''), [provider, setProvider] = useState('paypal'), [busy, setBusy] = useState(false), [error, setError] = useState(''), [accepted, setAccepted] = useState(false)
  const method = quote?.methods.find(m => m.uid === methodUid)
  async function shipping(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setQuote(null)
    const data = new FormData(event.currentTarget), quantity = Number(data.get('quantity'))
    const address = Object.fromEntries([...fields.map(([key]) => [key, data.get(key)]), ['country', data.get('country')]])
    try {
      const response = await fetch('/api/shop/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, quantity }) })
      const result = await response.json(); if (!response.ok) throw new Error(result.error)
      setQuote({ ...result, quantity }); setMethodUid(result.methods[0].uid)
    } catch (e) { setError(e instanceof Error ? e.message : 'Versand konnte nicht berechnet werden.') } finally { setBusy(false) }
  }
  async function pay() {
    if (!quote || !method || !accepted || busy) return
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/shop/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: quote.token, shippingMethodUid: method.uid, provider, acceptedTerms: accepted }) })
      const result = await response.json(); if (!response.ok) throw new Error(result.error)
      window.location.assign(result.url)
    } catch (e) { setError(e instanceof Error ? e.message : 'Zahlung konnte nicht gestartet werden.'); setBusy(false) }
  }
  const input = 'mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-3 text-stone-900 focus:outline-emerald-700'
  return <div className="">
    <form onSubmit={shipping} onChange={() => { setQuote(null); setAccepted(false) }} className="rounded-2xl border border-stone-300 bg-white p-5 md:p-8">
      <h2 className="text-xl font-semibold">1. Lieferadresse</h2><p className="mt-2 text-sm text-stone-600">Schorschy&apos;s Wanderkalender 2027 · A3 · 29,90 € pro Kalender, zuzüglich Versand</p>
      <fieldset disabled={busy} className="mt-5 grid gap-4 sm:grid-cols-2">
        {fields.map(([key, label, autoComplete, maxLength]) => <label key={key} className="text-sm">{label}<input className={input} name={key} autoComplete={autoComplete} maxLength={maxLength} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} required={!['addressLine2', 'phone'].includes(key)} /></label>)}
        <label className="text-sm">Land<select className={input} name="country"><option value="DE">Deutschland</option><option value="AT">Österreich</option><option value="CH">Schweiz</option></select></label>
        <label className="text-sm">Anzahl<input className={input} type="number" name="quantity" min={1} max={10} step={1} defaultValue={1} required /></label>
      </fieldset>
      <p className="mt-5 text-sm text-stone-600">Für Versandberechnung, Produktion und Lieferung übermitteln wir die erforderlichen Angaben an unsere Produktions- und Versanddienstleister. <Link className="underline" href="/datenschutz">Datenschutz</Link></p>
      <button disabled={busy} className="mt-5 rounded-lg bg-[#527052] text-white px-5 py-3 font-semibold disabled:opacity-50">{busy ? 'Bitte warten …' : 'Versandkosten berechnen'}</button>
    </form>
    {quote && method && <section className="mt-6 rounded-2xl border border-stone-300 bg-white p-5 md:p-8">
      <h2 className="text-xl font-semibold">2. Versand und Zahlung</h2>
      <fieldset disabled={busy} className="mt-4 space-y-3"><legend className="sr-only">Versandart</legend>{quote.methods.map(m => <label key={m.uid} className="flex items-center gap-3 rounded-lg border border-stone-300 p-3"><input type="radio" name="shipping" checked={methodUid === m.uid} onChange={() => { setMethodUid(m.uid); setAccepted(false) }} /> <span className="flex-1">{m.name}<small className="block text-stone-600">Voraussichtlich {m.minDays}–{m.maxDays} Tage für Produktion und Lieferung</small></span><strong>{euro(m.shippingCents)}</strong></label>)}</fieldset>
      <dl className="my-6 space-y-2"><div className="flex justify-between"><dt>{quote.quantity} × Kalender</dt><dd>{euro(quote.quantity * quote.unitPriceCents)}</dd></div><div className="flex justify-between"><dt>Versand</dt><dd>{euro(method.shippingCents)}</dd></div><div className="flex justify-between border-t border-stone-300 pt-3 text-xl font-bold"><dt>Gesamt</dt><dd>{euro(quote.quantity * quote.unitPriceCents + method.shippingCents)}</dd></div></dl>
      <p className="text-sm text-stone-600">Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.</p>
      <fieldset disabled={busy} className="mt-6 flex flex-wrap gap-5"><legend className="mb-3 font-semibold">Zahlungsart</legend>{[['paypal', 'PayPal'], ['stripe', 'Kredit- oder Debitkarte']].map(([value, label]) => <label key={value} className="flex items-center gap-2"><input type="radio" name="provider" checked={provider === value} onChange={() => setProvider(value)} />{label}</label>)}</fieldset>
      <label className="mt-6 flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} /><span>Ich habe meine Lieferadresse und den Gesamtbetrag geprüft. Die <Link href="/shop/bestellinformationen" target="_blank" className="underline">Bestellinformationen</Link> und die <Link href="/shop/widerruf" target="_blank" className="underline">Widerrufsbelehrung</Link> einschließlich der von mir zu tragenden Rücksendekosten bei einem normalen Widerruf habe ich zur Kenntnis genommen.</span></label>
      <button type="button" onClick={pay} disabled={busy || !accepted} className="mt-6 w-full rounded-lg bg-[#527052] text-white px-5 py-4 font-bold disabled:opacity-50">{busy ? 'Zahlung wird vorbereitet …' : provider === 'paypal' ? 'Weiter zu PayPal' : 'Weiter zur Kartenzahlung'}</button>
      <p className="mt-3 text-sm text-stone-600">Die Zahlung schließt du auf der sicheren Seite des Zahlungsanbieters ab.</p>
    </section>}
    {error && <p role="alert" className="mt-5 rounded-lg border border-red-400/40 bg-red-50 text-red-900 p-4">{error}</p>}
  </div>
}
