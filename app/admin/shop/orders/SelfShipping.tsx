'use client'

import { useState, type FormEvent } from 'react'
import { merchandiseRequest } from '../products/request'

export default function SelfShipping({ unitId, shipping, delivery, onSaved }: {
  unitId: string; shipping: string; delivery: string; onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ready = shipping === 'ready'
  const awaitingDelivery = shipping === 'shipped' && delivery === 'unknown'
  if (!ready && !awaitingDelivery) return null

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      await merchandiseRequest('', ready ? {
        action: 'ship', unit: unitId, carrier: form.get('carrier'), tracking: form.get('tracking'), url: form.get('url'),
      } : { action: 'deliver', unit: unitId })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bestätigung fehlgeschlagen.')
    } finally { setBusy(false) }
  }

  return <form className="mt-4 space-y-3 border-t border-white/15 pt-4" onSubmit={submit}>
    {ready && <>
      <p>Bestätige den Versand, sobald das Paket dem Versanddienstleister übergeben wurde.</p>
      <label className="block">Versanddienstleister<input className="ml-2 border px-2" name="carrier" required maxLength={120} /></label>
      <label className="block">Trackingnummer<input className="ml-2 border px-2" name="tracking" maxLength={120} /></label>
      <label className="block">Trackinglink<input className="ml-2 border px-2" name="url" type="url" maxLength={2048} /></label>
    </>}
    {awaitingDelivery && <p>Bestätige die Zustellung anhand eines Zustellnachweises.</p>}
    <button className="rounded-lg border border-white/20 px-4 py-2 disabled:opacity-50" disabled={busy}>
      {ready ? 'Versand bestätigen' : 'Zustellung bestätigen'}
    </button>
    {error && <p role="alert" className="text-amber-200">{error}</p>}
  </form>
}
