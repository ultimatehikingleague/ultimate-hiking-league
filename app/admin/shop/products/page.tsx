'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import {
  fulfillmentLabels, statusLabels, worldLabels, type Merchandise,
} from '../../../lib/shop/merchandise'
import ProductShipping, { productShippingFields } from './ProductShipping'
import ProductImages, { uploadProductImage, type ProductImage } from './ProductImages'
import { supabase } from '../../../lib/supabase'
import { merchandiseSku } from '../../../lib/shop/merchandise'
import { merchandiseRequest } from './request'

type CatalogRow = { sku: string; name: string; unit_price_cents: number; currency: string; active: boolean }
type LegacyRow = { id: string; slug: string; name: string; price_cents: number; currency: string; status: string }
type InventoryEntry = {
  id: string; order_line_id: string | null; quantity: number; state: string; reason: string | null;
  actor_id: string | null; created_at: string; settled_at: string | null;
}
type ProductPage = { products: Merchandise[]; more: boolean; cursor: string | null; catalog?: CatalogRow[]; legacy?: LegacyRow[] }
const empty: Merchandise = {
  sku: '', name: '', description: '', price_cents: null, category: '', collection: '',
  product_world: 'league', image_urls: [], status: 'draft', fulfillment_type: 'self',
  parent_sku: null, stock_on_hand: 0, stock_reserved: 0, stock_sold: 0, shipping_config: null, version: '',
}
const panel = 'rounded-xl border border-white/15 p-5'
const input = 'mt-1 block w-full rounded-lg border border-white/20 bg-stone-900 px-3 py-2 text-white'
const button = 'rounded-lg border border-white/20 px-4 py-2 font-semibold disabled:opacity-50'
const money = (cents: number | null, currency = 'EUR') => cents === null ? 'Offen'
  : new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(cents / 100)
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Aktion fehlgeschlagen.'

export default function ShopProductsPage() {
  const [page, setPage] = useState<ProductPage | null>(null)
  const [selection, setSelection] = useState<Merchandise | null>(null)
  const [error, setError] = useState('')
  const [moreBusy, setMoreBusy] = useState(false)

  useEffect(() => {
    let active = true
    void merchandiseRequest().then(result => { if (active) setPage(result) })
      .catch(err => { if (active) setError(errorMessage(err)) })
    return () => { active = false }
  }, [])

  async function more() {
    if (!page?.cursor) return
    setMoreBusy(true)
    setError('')
    try {
      const next: ProductPage = await merchandiseRequest('?after=' + encodeURIComponent(page.cursor))
      setPage(current => current && ({ ...current, products: [...current.products, ...next.products.filter(row => !current.products.some(old => old.sku === row.sku))], more: next.more, cursor: next.cursor }))
    } catch (err) { setError(errorMessage(err)) }
    finally { setMoreBusy(false) }
  }

  function saved(product: Merchandise) {
    setSelection(product)
    setPage(current => {
      if (!current) return current
      const products = current.products.some(row => row.sku === product.sku)
        ? current.products.map(row => row.sku === product.sku ? product : row)
        : [...current.products, product].sort((a, b) => a.sku < b.sku ? -1 : 1)
      return { ...current, products }
    })
  }

  return <main className="min-h-screen bg-[#141312] px-6 py-12 text-white md:px-10">
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/admin/shop" className="text-stone-300 underline">Zurück zur Shop-Administration</Link>
      <h1 className="text-4xl font-bold">Produktverwaltung</h1>
      <p className="text-stone-300">Hier vorbereitete Produkte bleiben intern. „Aktiv“ bedeutet bereit für eine spätere Freigabe.</p>
      {error && <p role="alert" className="text-amber-200">{error}</p>}
      {!page && !error && <p role="status">Produktverwaltung wird geladen …</p>}
      {page && <>
        <section className={panel}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Merchandise</h2>
            <button className={button} onClick={() => setSelection(empty)}>Neues Produkt</button>
          </div>
          {!page.products.length && <p className="mt-3">Keine Produkte vorhanden.</p>}
          <ul className="mt-3 divide-y divide-white/15">
            {page.products.map(product => <li key={product.sku} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <strong>{product.name}</strong>
                <p className="text-sm text-stone-300">{product.sku} · {statusLabels[product.status]} · {money(product.price_cents)} · {fulfillmentLabels[product.fulfillment_type]}</p>
                {product.fulfillment_type === 'self' && <p className="text-sm text-stone-300">
                  {product.stock_on_hand - product.stock_reserved} verfügbar · {product.stock_reserved} reserviert · {product.stock_sold} verkauft
                </p>}
              </div>
              <button className={button} onClick={() => setSelection(product)}>Bearbeiten<span className="sr-only"> {product.name}</span></button>
            </li>)}
          </ul>
          {page.more && <button className={button} disabled={moreBusy} onClick={more}>Weitere Produkte laden</button>}
        </section>
        {selection && <ProductEditor key={selection.sku} product={selection} onSave={saved} onClose={() => setSelection(null)} />}
        <section className={panel}>
          <h2 className="text-xl font-bold">Bestehender Checkout-Katalog</h2>
          <p className="mt-2 text-stone-300">Diese Verkaufskonfiguration wird hier angezeigt und separat verwaltet.</p>
          <ul className="mt-2 space-y-2">{page.catalog?.map(row => <li key={row.sku}>{row.name} · {row.sku} · {money(row.unit_price_cents, row.currency)} · {row.active ? 'Aktiv' : 'Inaktiv'}</li>)}</ul>
          {!!page.legacy?.length && <details className="mt-4">
            <summary className="cursor-pointer">Bisherige redaktionelle Produktliste</summary>
            <ul className="mt-2 space-y-2">{page.legacy.map(row => <li key={row.id}>{row.name} · {row.slug} · {money(row.price_cents, row.currency)} · {row.status}</li>)}</ul>
          </details>}
        </section>
      </>}
    </div>
  </main>
}

function ProductEditor({ product, onSave, onClose }: {
  product: Merchandise; onSave: (product: Merchandise) => void; onClose: () => void;
}) {
  const [fulfillment, setFulfillment] = useState(product.fulfillment_type)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [images, setImages] = useState<ProductImage[]>(() => product.image_urls.map((url, index) => ({ id: 'saved-' + index, url })))
  const [progress, setProgress] = useState<{ index: number; total: number; percent: number } | null>(null)
  const existing = Boolean(product.version)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const value = (key: string) => String(values.get(key) ?? '').trim()
    setBusy(true)
    setFeedback('')
    try {
      const sku = existing ? product.sku : value('sku').toUpperCase()
      if (!merchandiseSku.test(sku)) throw Error('Bitte eine gültige SKU mit 2 bis 64 Zeichen eingeben.')
      const ready = [...images]
      const pending = ready.filter(image => image.file && !image.url).length
      if (pending) {
        const { data } = await supabase.auth.getSession()
        if (!data.session) throw Error('Bitte als Administrator anmelden.')
        let index = 0
        for (const [position, image] of ready.entries()) {
          if (!image.file || image.url) continue
          index++
          const update = (percent: number) => setProgress({ index, total: pending, percent })
          update(0)
          try {
            const url = await uploadProductImage(image.file, sku, data.session.access_token, update)
            ready[position] = { ...image, url }
            setImages([...ready])
          } catch (error) {
            throw Error(image.file.name + ' · ' + errorMessage(error))
          }
        }
      }
      setProgress(null)
      const result = await merchandiseRequest('', {
        action: existing ? 'edit' : 'create',
        sku,
        version: product.version,
        name: value('name'), description: value('description'), category: value('category'),
        collection: value('collection'), product_world: value('product_world'),
        status: value('status'), fulfillment_type: fulfillment,
        ...productShippingFields(values),
        price_cents: value('price_cents') ? Number(value('price_cents')) : null,
        image_urls: ready.map(image => image.url),
      })
      setImages(ready.map(({ id, url }) => ({ id, url })))
      onSave(result.product)
      setFeedback('Produkt gespeichert.')
    } catch (err) { setFeedback(errorMessage(err)) }
    finally { setBusy(false); setProgress(null) }
  }

  return <section className={panel}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold">{existing ? product.name : 'Neues Produkt'}</h2>
      <button className={button} disabled={busy} onClick={onClose}>Schließen</button>
    </div>
    <form key={product.version} onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
      <label>Produktname<input className={input} name="name" required maxLength={160} defaultValue={product.name} /></label>
      <label>SKU<input className={input} name="sku" required readOnly={existing || busy || images.some(image => image.file && image.url)} maxLength={64} defaultValue={product.sku} /></label>
      <label>Preis in Eurocent<input className={input} name="price_cents" type="number" min="1" max="2147483647" defaultValue={product.price_cents ?? ''} /></label>
      <label>Kategorie<input className={input} name="category" maxLength={120} defaultValue={product.category} /></label>
      <label>Produktwelt<select className={input} name="product_world" defaultValue={product.product_world}>
        {Object.entries(worldLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Kollektion<input className={input} name="collection" maxLength={120} defaultValue={product.collection} /></label>
      <label>Status<select className={input} name="status" defaultValue={product.status}>
        {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Fulfillment<select className={input} name="fulfillment_type" value={fulfillment} onChange={event => setFulfillment(event.target.value as Merchandise['fulfillment_type'])}>
        {Object.entries(fulfillmentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label className="sm:col-span-2">Beschreibung<textarea className={input} name="description" maxLength={10000} rows={3} defaultValue={product.description} /></label>
      <ProductShipping config={product.shipping_config} fulfillment={fulfillment} disabled={busy} />
      <ProductImages images={images} onChange={setImages} busy={busy} progress={progress} />
      <div><button className={button} disabled={busy}>Produkt speichern</button></div>
    </form>
    {feedback && <p role="status" className="mt-3">{feedback}</p>}
    {existing && product.fulfillment_type === 'self' && <StockEditor product={product} onSave={onSave} />}
  </section>
}

const entryLabels: Record<string, string> = {
  adjustment: 'Bestandsbuchung', reserved: 'Reserviert', sold: 'Verkauft', released: 'Freigegeben',
}

function StockEditor({ product, onSave }: { product: Merchandise; onSave: (product: Merchandise) => void }) {
  const [entries, setEntries] = useState<InventoryEntry[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [requestId, setRequestId] = useState<string | null>(null)
  const query = '?sku=' + encodeURIComponent(product.sku)
  async function history() {
    setBusy(true)
    setFeedback('')
    try { setEntries((await merchandiseRequest(query)).entries) }
    catch (err) { setFeedback(errorMessage(err)) }
    finally { setBusy(false) }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const id = requestId ?? crypto.randomUUID()
    setRequestId(id)
    setBusy(true)
    setFeedback('')
    try {
      const result = await merchandiseRequest('', {
        action: 'stock', sku: product.sku, delta: Number(values.get('delta')), reason: values.get('reason'), requestId: id,
      })
      onSave(result.product)
      form.reset()
      setRequestId(null)
      setEntries(null)
      setFeedback('Bestand gespeichert.')
    } catch (err) { setFeedback(errorMessage(err)) }
    finally { setBusy(false) }
  }
  return <section className="mt-6 border-t border-white/15 pt-5">
    <h3 className="text-lg font-bold">Lagerbestand</h3>
    <p className="mt-2">{product.stock_on_hand} physisch · {product.stock_on_hand - product.stock_reserved} verfügbar · {product.stock_reserved} reserviert · {product.stock_sold} verkauft</p>
    <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={submit}>
      <label>Änderung (+/−)<input className={input} name="delta" type="number" required min="-1000000" max="1000000" /></label>
      <label>Grund<input className={input} name="reason" required maxLength={250} /></label>
      <button className={button} disabled={busy}>Bestand buchen</button>
    </form>
    <button className="mt-4 underline" disabled={busy} onClick={history}>Letzte 30 Buchungen laden</button>
    {feedback && <p role="status" className="mt-3">{feedback}</p>}
    {entries && <ul className="mt-2 space-y-2 text-sm">{entries.map(entry => <li key={entry.id}>
      {new Date(entry.settled_at ?? entry.created_at).toLocaleString('de-DE')} · {entryLabels[entry.state]} · {entry.quantity}
      {entry.reason && ' · ' + entry.reason}{entry.order_line_id && ' · Position ' + entry.order_line_id}
      {entry.actor_id && ' · Admin ' + entry.actor_id}
    </li>)}</ul>}
  </section>
}
