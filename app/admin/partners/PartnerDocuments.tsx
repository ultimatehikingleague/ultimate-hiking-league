'use client'

import PlacementApproval, { type Approval, type SocialMention } from './PlacementApproval'
import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { PartnerTerms } from '../../lib/partners/documents'

type Dossier = {
  terms: PartnerTerms
  accepted_on: string | null
  payment_requested_at: string | null
  payment_due_on: string | null
  paid_on: string | null
  cancellation_at: string | null
  cancellation_reason: string | null
  invoice_number: string | null
  invoice_archived: boolean
}
type Cooperation = {
  kind: 'in_kind' | 'goodwill' | 'unpaid_milestone'
  explanation: string
  term_kind: 'fixed' | 'partnership' | 'minimum'
  agreed_start: string
  minimum_end: string | null
  effective_end: string | null
  fulfilled_on: string | null
}
type DocumentKind = 'offer' | 'contract' | 'payment' | 'invoice-draft' | 'invoice'
const field = 'mt-1 block w-full rounded-lg border border-white/20 bg-[#221f1b] px-3 py-2 text-white'
const button = 'rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white disabled:opacity-50'
const currency = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

async function request(id: string, params: RequestInit = {}, file?: DocumentKind) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Bitte erneut anmelden.')
  const query = new URLSearchParams({ id })
  if (file) query.set('file', file)
  const response = await fetch('/api/admin/partners/documents?' + query, {
    ...params,
    headers: { Authorization: 'Bearer ' + session.access_token, ...params.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error ?? 'Die Anfrage konnte nicht verarbeitet werden.')
  }
  return response
}

async function readContract(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || !file.size || file.size > 3_000_000) throw new Error('Bitte eine Vertrags-PDF bis 3 MB auswählen.')
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Vertrags-PDF konnte nicht gelesen werden.'))
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.readAsDataURL(file)
  })
}

export default function PartnerDocuments({ bookingId, status, bookingType, packageCode, agreedPrice, start, end }: {
  bookingId: string
  status: string
  bookingType: 'brand_partner' | 'event_partner'
  packageCode: string
  agreedPrice: number | null
  start: string
  end: string
}) {
  const [dossier, setDossier] = useState<Dossier | null | undefined>(undefined)
  const milestone = bookingType === 'brand_partner' && packageCode === 'M'
  const free = agreedPrice === 0
  const isDraft = status === 'draft'
  const [approval, setApproval] = useState<Approval | null>(null)
  const [social, setSocial] = useState<SocialMention | null>(null)
  const [cooperation, setCooperation] = useState<Cooperation | null>(null)
  const [termKind, setTermKind] = useState('fixed')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [today] = useState(() => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date()))

  async function load() {
    const response = await request(bookingId)
    const data = await response.json()
    setDossier(data.dossier)
    setCooperation(data.cooperation)
    setApproval(data.approval)
    setSocial(data.social)
  }

  useEffect(() => { void load().catch(error => setMessage(error.message)) }, [bookingId]) // eslint-disable-line react-hooks/exhaustive-deps

  const action = cooperation ? 'fulfill-cooperation'
    : !dossier ? (free ? 'record-cooperation' : 'offer') : !dossier.accepted_on ? 'accept'
    : !dossier.payment_requested_at ? 'request-payment' : !dossier.paid_on ? 'confirm-payment' : 'invoice'

  async function submit(event: FormEvent<HTMLFormElement>, operation: string = action) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const form = new FormData(event.currentTarget)
      const payload: Record<string, unknown> = { id: bookingId, action: operation, ...Object.fromEntries(form) }
      if (operation === 'accept') payload.contract = await readContract(form.get('contract'))
      if (operation === 'request-payment') payload.days = Number(form.get('days'))
      if (operation === 'confirm-payment') {
        const amount = String(form.get('amount')).replace(',', '.')
        if (!/^\d+(\.\d{1,2})?$/.test(amount)) throw new Error('Bitte einen Betrag mit höchstens zwei Nachkommastellen angeben.')
        payload.cents = Math.round(Number(amount) * 100)
      }
      await request(bookingId, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Speichern fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  async function changePlacement(payload: Record<string, unknown>) {
    setBusy(true)
    setMessage('')
    try {
      await request(bookingId, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bookingId, ...payload }) })
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Freigabe konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  async function download(kind: DocumentKind, title: string) {
    setBusy(true)
    setMessage('')
    try {
      const response = await request(bookingId, {}, kind)
      const href = URL.createObjectURL(await response.blob())
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = title + '.pdf'
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(href), 1000)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Download fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  const documentButton = (kind: DocumentKind, label: string, reference = label + '-' + bookingId) => (
    <button type="button" className={button} disabled={busy} onClick={() => void download(kind, reference)}>{label} ↓</button>
  )
  const overdue = dossier?.payment_due_on && dossier.payment_due_on < today && !dossier.paid_on && !dossier.cancellation_at

  return (
    <section className="grid gap-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm">
      <h3 className="font-semibold text-white">{milestone ? 'Milestone-Präsenz freigeben' : 'Angebot, Vertrag und Vorkasse'}</h3>
      {dossier === undefined && !message && <p>Unterlagen werden geladen …</p>}
      {dossier && <>
        <p>{dossier.terms.packageName} · {currency.format(dossier.terms.amountCents / 100)} · {dossier.terms.start} bis {dossier.terms.end}</p>
        {dossier.accepted_on && <p>Vertrag angenommen am {dossier.accepted_on}</p>}
        {dossier.cancellation_at && <p>
          Beendigung dokumentiert am {new Date(dossier.cancellation_at).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })}
          {' · '}{dossier.cancellation_reason}
        </p>}
        {dossier.payment_due_on && <p className={overdue ? 'text-amber-200' : undefined}>
          {dossier.paid_on ? 'Zahlung bestätigt am ' + dossier.paid_on : 'Fällig am ' + dossier.payment_due_on}
          {overdue && ' · Überfällig, Vertragsstatus prüfen'}
        </p>}
        <div className="flex flex-wrap gap-2">
          {documentButton('offer', 'Angebot', 'ANG-' + bookingId)}
          {dossier.accepted_on && documentButton('contract', 'Vertrag')}
          {dossier.payment_requested_at && documentButton('payment', 'Zahlungsanforderung', 'ZA-' + bookingId)}
          {dossier.paid_on && !dossier.invoice_number && documentButton('invoice-draft', 'Rechnungsentwurf')}
          {dossier.invoice_archived && documentButton('invoice', 'Rechnung', dossier.invoice_number ?? 'Rechnung')}
        </div>
        {overdue && (
          <details className="rounded-lg border border-white/10 p-3">
            <summary className="cursor-pointer">Bereits erklärte Beendigung dokumentieren</summary>
            <form onSubmit={event => void submit(event, 'record-cancellation')} className="mt-3 grid max-w-xl gap-2">
              <label>Begründung oder Nachweis<textarea className={field} name="reason" required maxLength={500} /></label>
              <button type="submit" className={button + ' justify-self-start'} disabled={busy}>Beendigung archivieren</button>
            </form>
          </details>
        )}
      </>}
      {dossier === null && !cooperation && isDraft && !milestone && agreedPrice === null && (
        <p>Bitte zuerst in der Buchung einen vereinbarten Preis speichern. Für eine kostenlose Kooperation 0,00 € eintragen.</p>
      )}
      {cooperation && <>
        <p>{{ in_kind: 'Sachleistungskooperation', goodwill: 'Kulanz', unpaid_milestone: 'Unentgeltliche Milestone-Partnerschaft' }[cooperation.kind]} · {cooperation.explanation}</p>
        {cooperation.kind === 'unpaid_milestone' && <p>Ohne Zahlung, Provision, Umsatzbeteiligung und Rechnung.</p>}
        <p>Start {cooperation.agreed_start} · Ende {cooperation.effective_end ?? 'bei Partnerschaftsende'}</p>
        {cooperation.minimum_end && <p>Garantiert mindestens bis {cooperation.minimum_end}</p>}
        {cooperation.fulfilled_on && <p>Gegenleistung erfüllt am {cooperation.fulfilled_on}</p>}
        {cooperation.term_kind !== 'fixed' && !cooperation.effective_end && (
          <form onSubmit={event => void submit(event, 'close-partnership')} className="grid max-w-xl gap-2">
            <label>Partnerschaftsende<input className={field} name="date" type="date" min={cooperation.agreed_start} required /></label>
            <button type="submit" className={button + ' justify-self-start'} disabled={busy}>Partnerschaftsende erfassen</button>
          </form>
        )}
      </>}
      {!milestone && dossier !== undefined && (dossier || cooperation || (isDraft && agreedPrice !== null)) && !dossier?.invoice_archived && !dossier?.cancellation_at
        && !((cooperation && cooperation.kind !== 'in_kind') || cooperation?.fulfilled_on) && (
        <form key={action} onSubmit={event => void submit(event)} className="grid max-w-xl gap-3">
          {action === 'record-cooperation' && <>
            <label>Art<select className={field} name="kind" defaultValue="goodwill"><option value="unpaid_milestone">Unentgeltliche Milestone-Partnerschaft</option><option value="in_kind">Sachleistung</option><option value="goodwill">Kulanz</option></select></label>
            <label>Vereinbarung, Gegenleistung oder Kulanzgrund<textarea className={field} name="explanation" required maxLength={2000} /></label>
            <label>Laufzeit<select className={field} name="termKind" value={termKind} onChange={event => setTermKind(event.target.value)}>
              <option value="fixed">Festes Ende</option><option value="partnership">Bis Partnerschaftsende</option>
              <option value="minimum">Garantierte Mindestlaufzeit plus Partnerschaftsende</option>
            </select></label>
            {termKind === 'fixed' && <label>Festes Ende<input className={field} name="fixedEnd" type="date" defaultValue={end} required /></label>}
            {termKind !== 'fixed' && <label>Partnerschaftsende, sofern bekannt<input className={field} name="partnershipEnd" type="date" /></label>}
            {termKind === 'minimum' && <label>Mindestlaufzeit bis<input className={field} name="minimumEnd" type="date" required /></label>}
          </>}
          {action === 'fulfill-cooperation' && <>
            <label>Erfüllt am<input className={field} type="date" name="date" max={today} defaultValue={today} required /></label>
            <label>Nachweis zur Gegenleistung<input className={field} name="note" maxLength={500} required /></label>
          </>}
          {action === 'offer' && <>
            <label>Rechnungsempfänger<input className={field} name="recipient" required maxLength={180} /></label>
            <label>Vollständige Anschrift<textarea className={field} name="address" required maxLength={450} rows={3} /></label>
            <label>Zusätzliche Angebotsdetails<textarea className={field} name="services" maxLength={1700} rows={3} /></label>
            <label>Gültig bis<input className={field} type="date" name="date" min={today} required /></label>
          </>}
          {action === 'accept' && <>
            <label>Angenommen am<input className={field} type="date" name="date" defaultValue={today} max={today} required /></label>
            <label>Unterschriebener Vertrag (PDF, bis 3 MB)<input className={field} type="file" name="contract" accept="application/pdf,.pdf" required /></label>
          </>}
          {action === 'request-payment' && <label>Zahlungsfrist<select className={field} defaultValue="7" name="days">
            <option value="0">Sofort</option><option value="7">7 Kalendertage</option><option value="14">14 Kalendertage</option>
          </select></label>}
          {action === 'confirm-payment' && <>
            <label>Zahlung eingegangen am<input className={field} type="date" name="date" defaultValue={today} max={today} required /></label>
            <label>Tatsächlich eingegangener Betrag (EUR)<input className={field} inputMode="decimal" name="amount" required /></label>
            <label>Zahlungsvermerk<input className={field} name="note" maxLength={500} required /></label>
          </>}
          <button type="submit" disabled={busy} className={button + ' justify-self-start'}>
            {({
              'record-cooperation': 'Kooperation archivieren', 'fulfill-cooperation': 'Gegenleistung bestätigen',
              offer: 'Angebot erstellen und archivieren', accept: 'Annahme und Vertrag archivieren',
              'request-payment': 'Zahlungsanforderung erstellen', 'confirm-payment': 'Zahlungseingang bestätigen',
              invoice: dossier?.invoice_number ? 'Rechnungs-PDF erneut erstellen' : 'Rechnung ausstellen',
            })[action]}
          </button>
        </form>
      )}
      {dossier !== undefined && (
        <PlacementApproval bookingType={bookingType} packageCode={packageCode} approval={approval} social={social}
          agreedStart={milestone ? start : dossier?.terms.start ?? cooperation?.agreed_start}
          effectiveEnd={milestone ? end : cooperation ? cooperation.effective_end : dossier?.terms.end}
          today={today} eligible={milestone || Boolean(dossier?.paid_on || cooperation?.fulfilled_on || (cooperation && cooperation.kind !== 'in_kind'))}
          canApprove={status === 'draft' || status === 'paused'} busy={busy} submit={changePlacement} />
      )}
      {message && <p role="alert" className="text-amber-200">{message}</p>}
    </section>
  )
}
