'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../../lib/supabase'

type Voucher = {
  code: string
  kind: 'percent' | 'fixed'
  value: number
  sku: string | null
  starts_at: string | null
  ends_at: string | null
  minimum_cents: number
  usage_limit: number | null
  active: boolean
  status: string
  used: number
  reserved: number
}
type HistoryRow = {
  id: string
  mode: string
  status: string
  discount_cents: number
  created_at: string
  paid_at: string | null
}
type Listing = {
  vouchers: Voucher[]
  products?: { sku: string; name: string; active: boolean }[]
  next: string | null
  mode: string
}

const input = 'mt-1 block w-full rounded-lg border border-stone-300 bg-white p-2'
const button = 'rounded-lg border border-stone-300 px-3 py-2 disabled:opacity-50'
const money = (cents: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
const date = (value: string | null) => value ? new Date(value).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }) : '–'
const voucherStatus: Record<string, string> = {
  active: 'Aktiv', inactive: 'Deaktiviert', scheduled: 'Geplant',
  expired: 'Abgelaufen', exhausted: 'Aufgebraucht', reserved: 'Vollständig reserviert',
}
const orderStatus: Record<string, string> = {
  pending: 'Reserviert', paid: 'Eingelöst', failed: 'Freigegeben', refunded: 'Erstattet',
}

async function api(query = '', body?: object) {
  const { data } = await supabase.auth.getSession()
  const response = await fetch('/api/admin/shop/vouchers' + query, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: 'Bearer ' + (data.session?.access_token ?? ''),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error)
  return result
}

function downloadCsv(rows: (string | number | null)[][]) {
  const csv = rows.map(row => row.map(value => '"' + String(value ?? '').replaceAll('"', '""') + '"').join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'outdoor-store-gutscheine.csv'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function ShopVouchersPage() {
  const [listing, setListing] = useState<Listing | null>(null)
  const [products, setProducts] = useState<NonNullable<Listing['products']>>([])
  const [cursor, setCursor] = useState('')
  const [history, setHistory] = useState<{ code: string; rows: HistoryRow[]; next: string | null } | null>(null)
  const [kind, setKind] = useState('percent')
  const [usage, setUsage] = useState('once')
  const [generated, setGenerated] = useState<string[]>([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    api().then((result: Listing) => {
      setListing(result)
      setProducts(result.products ?? [])
    }).catch((e: Error) => setError(e.message)).finally(() => setBusy(false))
  }, [])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try { await action() }
    catch (e) { setError(e instanceof Error ? e.message : 'Die Aktion ist fehlgeschlagen.') }
    finally { setBusy(false) }
  }

  async function page(after: string) {
    const result: Listing = await api(after ? '?after=' + encodeURIComponent(after) : '')
    setListing(result)
    setCursor(after)
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const timestamp = (field: string) => form.get(field) ? new Date(String(form.get(field))).toISOString() : null
    void run(async () => {
      const result = await api('', {
        action: 'create',
        code: String(form.get('code') ?? '').trim(),
        count: Number(form.get('count')),
        kind,
        value: kind === 'percent' ? Number(form.get('value')) : Math.round(Number(form.get('value')) * 100),
        sku: form.get('sku') || null,
        startsAt: timestamp('startsAt'),
        endsAt: timestamp('endsAt'),
        minimumCents: Math.round(Number(form.get('minimum')) * 100),
        usageLimit: usage === 'once' ? 1 : form.get('limit') ? Number(form.get('limit')) : null,
      })
      setGenerated(result.created)
      await page('')
    })
  }

  async function showHistory(code: string, after = '') {
    const result = await api('?code=' + encodeURIComponent(code) + '&after=' + encodeURIComponent(after))
    setHistory(current => ({ code, rows: after && current?.code === code ? [...current.rows, ...result.history] : result.history, next: result.next }))
  }

  async function exportAll() {
    const rows: (string | number | null)[][] = [['Code', 'Rabattart', 'Wert', 'SKU', 'Gültig ab (UTC)', 'Gültig bis (UTC)', 'Mindestwarenwert (Cent)', 'Nutzungslimit', 'Eingelöst', 'Reserviert', 'Status', 'Modus']]
    let after: string | null = ''
    do {
      const result: Listing = await api(after ? '?after=' + encodeURIComponent(after) : '')
      for (const v of result.vouchers) rows.push([v.code, v.kind === 'percent' ? 'Prozent' : 'Cent', v.value, v.sku, v.starts_at, v.ends_at, v.minimum_cents, v.usage_limit, v.used, v.reserved, voucherStatus[v.status], result.mode])
      after = result.next
    } while (after)
    downloadCsv(rows)
  }

  return <main className="min-h-screen bg-[#f8f6f0] text-stone-900"><div className="mx-auto max-w-6xl space-y-6 p-5 sm:p-8">
    <Link href="/admin/shop" className="underline">Zum Outdoor Store Admin</Link>
    <h1 className="text-3xl font-bold">Gutscheine</h1>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-900">{error}</p>}
    {busy && !listing && <p role="status">Gutscheine werden geladen …</p>}
    {listing && <>
      <form onSubmit={create} className="rounded-xl border border-stone-300 p-5">
        <h2 className="mb-4 text-xl font-semibold">Gutscheine erstellen</h2>
        <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label>Rabattart<select className={input} value={kind} onChange={e => setKind(e.target.value)}><option value="percent">Prozent</option><option value="fixed">Fester Eurobetrag</option></select></label>
          <label>Rabatt ({kind === 'percent' ? '%' : '€'})<input key={kind} className={input} name="value" type="number" min={kind === 'percent' ? 1 : 0.01} max={kind === 'percent' ? 100 : 21474836.47} step={kind === 'percent' ? 1 : 0.01} required /></label>
          <label>Produktbindung<select className={input} name="sku"><option value="">Gesamtes Sortiment</option>{products.map(p => <option key={p.sku} value={p.sku}>{p.name} · {p.sku}{p.active ? '' : ' (inaktiv)'}</option>)}</select></label>
          <label>Mindestwarenwert (€)<input className={input} type="number" name="minimum" min="0" max="21474836.47" step="0.01" /></label>
          <label>Gültig ab (Gerätezeit)<input className={input} type="datetime-local" name="startsAt" /></label>
          <label>Gültig bis (Gerätezeit)<input className={input} type="datetime-local" name="endsAt" /></label>
          <label>Nutzung<select className={input} value={usage} onChange={e => setUsage(e.target.value)}><option value="once">Einmalcode</option><option value="multiple">Mehrfachcode</option></select></label>
          {usage === 'multiple' && <label>Limit je Code (optional)<input className={input} type="number" name="limit" min="2" max="2147483647" /></label>}
          <label>Anzahl Codes<input className={input} type="number" name="count" min="1" max="250" defaultValue="1" required /></label>
          <label>Eigener Code (optional bei Anzahl 1)<input className={input} name="code" minLength={3} maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9_\x2d]{2,39}" /></label>
        </fieldset>
        <button disabled={busy} className={button + ' mt-4 bg-emerald-800 text-white'}>Erstellen</button>
        {generated.length > 0 && <div className="mt-4 flex items-center gap-3">
          <p role="status">{generated.length} Code(s) erstellt.</p>
          <button className={button} type="button" onClick={() => downloadCsv([['Code'], ...generated.map(code => [code])])}>Erstellte Codes herunterladen</button>
        </div>}
      </form>
      <section className="rounded-xl border border-stone-300 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Gutscheinübersicht · {listing.mode === 'live' ? 'Live' : 'Test'}</h2>
          <button disabled={busy} className={button} onClick={() => void run(exportAll)}>Alle Codes als CSV</button>
        </div>
        {!listing.vouchers.length ? <p>Keine Gutscheine vorhanden.</p> : <div className="overflow-auto"><table className="w-full text-left text-sm">
          <thead><tr>{['Code', 'Rabatt', 'Produkt', 'Gültigkeit (Berlin)', 'Mindestwert', 'Nutzung', 'Status', 'Aktionen'].map(h => <th key={h} className="p-2">{h}</th>)}</tr></thead>
          <tbody>{listing.vouchers.map(v => <tr key={v.code} className="border-t border-stone-200 align-top">
            <td className="p-2 font-mono">{v.code}</td><td className="p-2">{v.kind === 'percent' ? v.value + ' %' : money(v.value)}</td>
            <td className="p-2">{v.sku ?? 'Sortiment'}</td><td className="p-2">{date(v.starts_at)}<br/>{date(v.ends_at)}</td>
            <td className="p-2">{money(v.minimum_cents)}</td><td className="p-2">{v.used} / {v.usage_limit ?? '∞'}<br/>{v.reserved} reserviert</td>
            <td className="p-2">{voucherStatus[v.status]}</td>
            <td className="space-y-2 p-2">
              <button disabled={busy} className={button} onClick={() => void run(async () => {
                await api('', { action: 'activate', code: v.code, active: !v.active })
                await page(cursor)
              })}>{v.active ? 'Deaktivieren' : 'Aktivieren'}</button>
              <button disabled={busy} className={button} onClick={() => void run(() => showHistory(v.code))}>Verlauf</button>
            </td>
          </tr>)}</tbody>
        </table></div>}
        <div className="mt-4 flex gap-2">
          {cursor && <button disabled={busy} className={button} onClick={() => void run(() => page(''))}>Erste Seite</button>}
          {listing.next && <button disabled={busy} className={button} onClick={() => void run(() => page(listing.next!))}>Nächste Seite</button>}
        </div>
      </section>
      {history && <section className="rounded-xl border border-stone-300 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Verlauf · {history.code}</h2>
          <button className={button} onClick={() => setHistory(null)}>Schließen</button>
        </div>
        {history.rows.length ? <ul className="divide-y divide-stone-200">
          {history.rows.map(row => <li key={row.id} className="break-words py-2 text-sm"><strong>{orderStatus[row.status]}</strong> · {money(row.discount_cents)} · {date(row.paid_at ?? row.created_at)} · {row.mode} · {row.id}</li>)}
        </ul> : <p>Noch keine Bestellungen mit diesem Code.</p>}
        {history.next && <button disabled={busy} className={button + ' mt-4'} onClick={() => void run(() => showHistory(history.code, history.next!))}>Weitere Einträge</button>}
      </section>}
    </>}
  </div></main>
}
