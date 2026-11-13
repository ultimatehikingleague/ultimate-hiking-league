'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import type { ShippingRate } from '../../../lib/shop/shipping-config'
import { shopAdminRequest } from '../products/request'
import { buttonStyle, fieldStyle, formCountries, formNumber, formText } from './fields'

const endpoint = '/api/admin/shop/shipping'
const measurements = [
  ['max_length_mm', 'Max. Länge (mm)'],
  ['max_width_mm', 'Max. Breite (mm)'],
  ['max_depth_mm', 'Max. Höhe oder Dicke (mm)'],
  ['max_weight_g', 'Max. Gewicht (g)'],
] as const

const draft: ShippingRate = {
  code: '', name: '', carrier: '', mode: 'self', partner: null, zone: '', countries: [],
  price_cents: null, max_length_mm: null, max_width_mm: null, max_depth_mm: null,
  max_weight_g: null, tracking: null, delivery_estimate: null, valid_through: null, active: false, version: '',
}

export default function ShippingPage() {
  const [rates, setRates] = useState<ShippingRate[] | null>(null)
  const [selected, setSelected] = useState<ShippingRate | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void shopAdminRequest(endpoint).then(({ rates }) => { if (active) setRates(rates) })
      .catch(error => { if (active) setError(error.message) })
    return () => { active = false }
  }, [])

  function saved(rate: ShippingRate) {
    setRates(previous => [...(previous ?? []).filter(row => row.code !== rate.code), rate].sort((a, b) => a.code.localeCompare(b.code)))
    setSelected(rate)
  }

  return <main className="min-h-screen bg-[#141312] p-6 text-white sm:p-10">
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/admin/shop" className="text-stone-300 underline">Zurück zur Shop-Administration</Link>
      <h1 className="text-4xl font-bold">Versandarten & Tarife</h1>
      <p className="text-stone-300">Tarife für den künftigen Shop vorbereiten. Partnerpreise kommen bei der späteren Anbindung aus dem jeweiligen Versandangebot.</p>
      {error && <p role="alert" className="text-amber-200">{error}</p>}
      {!rates && !error && <p role="status">Versandarten werden geladen …</p>}
      {rates && <section className="rounded-xl border border-white/15 p-5">
        <button type="button" className={buttonStyle} onClick={() => setSelected(draft)}>Versandart anlegen</button>
        <ul className="mt-4 divide-y divide-white/15">
          {rates.map(rate => <li key={rate.code} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <strong>{rate.carrier} · {rate.name}</strong>
              <p className="text-sm text-stone-300">{rate.zone} · {rate.active ? 'Aktiv' : 'Inaktiv'} · {rate.price_cents === null ? 'Preis offen / Partnerangebot' : rate.price_cents + ' ct'}{rate.valid_through && ' · bis ' + rate.valid_through}</p>
            </div>
            <button type="button" className={buttonStyle} onClick={() => setSelected(rate)}>Bearbeiten<span className="sr-only"> {rate.name}</span></button>
          </li>)}
        </ul>
      </section>}
      {selected && <RateEditor key={selected.code + selected.version} rate={selected} onSave={saved} onClose={() => setSelected(null)} />}
    </div>
  </main>
}

function RateEditor({ rate, onSave, onClose }: {
  rate: ShippingRate; onSave: (rate: ShippingRate) => void; onClose: () => void
}) {
  const [mode, setMode] = useState(rate.mode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const tracking = formText(form, 'tracking')
    setBusy(true)
    setError('')
    try {
      const response = await shopAdminRequest(endpoint, {
        code: formText(form, 'code').toUpperCase(), version: rate.version, mode,
        name: formText(form, 'name'), carrier: formText(form, 'carrier'), zone: formText(form, 'zone'),
        partner: formText(form, 'partner') || null, countries: formCountries(form),
        price_cents: formNumber(form, 'price_cents'), active: form.has('active'),
        tracking: tracking === '' ? null : tracking === 'yes',
        delivery_estimate: formText(form, 'delivery_estimate') || null,
        valid_through: formText(form, 'valid_through') || null,
        ...Object.fromEntries(measurements.map(([key]) => [key, formNumber(form, key)])),
      })
      onSave(response.rate)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Versandart konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  return <form onSubmit={save} className="rounded-xl border border-white/15 p-5">
    <h2 className="mb-4 text-xl font-bold">{rate.version ? rate.name : 'Neue Versandart'}</h2>
    <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
      <label>Tarifcode<input name="code" className={fieldStyle} required maxLength={64} readOnly={!!rate.version} defaultValue={rate.code} /></label>
      <label>Versandbezeichnung<input name="name" className={fieldStyle} required maxLength={120} defaultValue={rate.name} /></label>
      <label>Versanddienstleister<input name="carrier" className={fieldStyle} required maxLength={120} defaultValue={rate.carrier} /></label>
      <label>Versandzone<input name="zone" className={fieldStyle} required maxLength={80} defaultValue={rate.zone} /></label>
      <label>Ländercodes, z. B. DE, AT<input name="countries" className={fieldStyle} defaultValue={rate.countries.join(', ')} /></label>
      <label>Fulfillment<select className={fieldStyle} value={mode} onChange={event => setMode(event.target.value as ShippingRate['mode'])}>
        <option value="self">Eigenversand</option><option value="partner">Externer Partner</option>
      </select></label>
      {mode === 'partner'
        ? <label>Partnerkennung<input name="partner" className={fieldStyle} required maxLength={40} defaultValue={rate.partner ?? ''} /></label>
        : <label>Versandpreis in Eurocent<input name="price_cents" className={fieldStyle} type="number" min="0" max="1000000" defaultValue={rate.price_cents ?? ''} /></label>}
      <label>Gültig bis einschließlich<input name="valid_through" className={fieldStyle} type="date" defaultValue={rate.valid_through ?? ''} /></label>
      {measurements.map(([key, label]) => <label key={key}>{label}
        <input name={key} className={fieldStyle} type="number" min="1" max={key === 'max_weight_g' ? 10000000 : 100000} defaultValue={rate[key] ?? ''} />
      </label>)}
      <label>Sendungsverfolgung<select name="tracking" className={fieldStyle} defaultValue={rate.tracking === null ? '' : rate.tracking ? 'yes' : 'no'}>
        <option value="">Offen</option><option value="yes">Verfügbar</option><option value="no">Keine</option>
      </select></label>
      <label>Lieferzeit<input name="delivery_estimate" className={fieldStyle} maxLength={120} defaultValue={rate.delivery_estimate ?? ''} /></label>
      <label><input name="active" className="mr-2" type="checkbox" defaultChecked={rate.active} />Tarif aktiv</label>
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className={buttonStyle}>Versandart speichern</button>
        <button type="button" className={buttonStyle} onClick={onClose}>Schließen</button>
      </div>
    </fieldset>
    {error && <p role="alert" className="mt-4 text-amber-200">{error}</p>}
  </form>
}
