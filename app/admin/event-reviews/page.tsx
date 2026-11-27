'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { supabase } from '@/app/lib/supabase'
import { reviewCategories, reviewCopy } from '@/app/lib/review-copy'

import AssignmentManager from './AssignmentManager'

const statuses = {
  pending: 'Offen',
  approved: 'Freigegeben',
  rejected: 'Abgelehnt',
  withdrawn: 'Zurückgenommen',
} as const

type Status = keyof typeof statuses
type Review = {
  id: number
  event_name: string
  organizer_name: string
  author_name: string | null
  stars: number[]
  comments: (string | null)[]
  status: Status
  invalidated: boolean
  has_proof: boolean
  revision: number
  is_revision: boolean
}

const input = 'rounded-lg border border-white/20 bg-stone-900 px-3 py-2 text-sm'
const button = 'rounded-lg border border-white/20 bg-white/5 px-4 py-2 hover:bg-white/10 disabled:opacity-50'
const copy = reviewCopy('de')

export default function AdminReviews() {
  const [allowed, setAllowed] = useState<boolean | null | 'error'>(null)
  const [filter, setFilter] = useState<Status>('pending')
  const [reviews, setReviews] = useState<Review[]>([])
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async (status: Status, before?: number) => {
    const { data, error } = await supabase.rpc('uhl_moderation_queue', { p_status: status, p_before: before ?? null })
    if (error?.code === '42501') { setAllowed(false); return }
    if (error) { setAllowed('error'); setMessage(copy.error); return }
    const rows = data as Review[]
    setAllowed(true)
    setMore(rows.length === 30)
    setReviews(current => before ? [...current, ...rows] : rows)
  }, [])

  useEffect(() => {
    void supabase.auth.getSession().then(({data}) => data.session ? load('pending') : setAllowed(false))
  }, [load])

  async function moderate(event: FormEvent<HTMLFormElement>, review: Review) {
    event.preventDefault()
    const form = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter)
    const target = form.get('decision') as Status
    setBusy(true)
    setMessage('')
    const { error } = await supabase.rpc('uhl_moderate_review', {
      p_review: review.id, p_status: target, p_note: String(form.get('note') ?? ''), p_revision: review.revision,
    })
    if (error) setMessage(copy.error)
    else { await load(filter); setMessage('Entscheidung gespeichert.') }
    setBusy(false)
  }

  async function redact(review: Review, category: number) {
    if (!window.confirm('Den Kommentar dauerhaft entfernen? Die Sterne bleiben erhalten.')) return
    setBusy(true)
    const { error } = await supabase.rpc('uhl_redact_review_comment', {
      p_review: review.id, p_category: category, p_note: 'Kommentar entfernt', p_draft: review.is_revision,
    })
    if (!error) await load(filter)
    setMessage(error ? copy.error : 'Kommentar entfernt.')
    setBusy(false)
  }

  return <main className="min-h-screen bg-[#141312] px-6 py-10 text-stone-100">
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/admin" className="text-amber-200 underline">Zum Adminbereich</Link>
      <h1 className="text-3xl font-bold">Veranstaltungsbewertungen moderieren</h1>
      {allowed === null && <p role="status">Berechtigung wird geprüft …</p>}
      {allowed === false && <p role="alert">Für diese Seite ist ein UHL-Administratorkonto erforderlich.</p>}
      {message && <p role="status" className="text-amber-200">{message}</p>}
      {allowed === true && <>
        <AssignmentManager />
        <label className="grid w-fit gap-2">Moderationsstatus
          <select className={input} value={filter} disabled={busy} onChange={async e => {
            const value = e.target.value as Status
            setFilter(value)
            setBusy(true)
            setReviews([])
            setMore(false)
            setMessage('')
            await load(value)
            setBusy(false)
          }}>
            {Object.entries(statuses).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <p className="text-sm text-stone-300">Sachliche Kritik und niedrige Bewertungen sind zulässig. Prüfe Inhalte unabhängig von Veranstaltern und Werbepartnerschaften. Entferne personenbezogene Angaben und Kommentare mit persönlichen Angriffen oder Herabwürdigungen vor der Veröffentlichung.</p>
        {!reviews.length && !busy && <p>Keine Bewertungen in dieser Ansicht.</p>}
        {reviews.map(review => <article key={review.id} className="space-y-3 rounded-xl border border-white/15 p-4">
          <h2 className="text-xl font-semibold">{review.event_name}</h2>
          <p className="text-sm text-stone-300">{review.organizer_name} · {review.author_name || 'Ohne Profilbezug'} · #{review.id}</p>
          {review.is_revision && <p className="text-amber-200">Überarbeitung. Die freigegebene Fassung bleibt bis zur Entscheidung sichtbar.</p>}
          {review.invalidated && <p className="text-red-300">Teilnahmebeleg ungültig. Diese Bewertung ist öffentlich ausgeschlossen.</p>}
          <ul className="grid gap-3 sm:grid-cols-2">
            {reviewCategories.map((category, i) => <li key={category} className="min-w-0 break-words">
              <span className="font-medium">{copy[category]}</span> · {review.stars[i]}/5 ★
              {review.comments[i] && <>
                <p className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere] text-stone-300">{review.comments[i]}</p>
                <button type="button" disabled={busy} onClick={() => void redact(review, i + 1)} className="text-sm text-red-300 underline">Kommentar entfernen</button>
              </>}
            </li>)}
          </ul>
          <form className="flex flex-wrap items-end gap-2" onSubmit={e => void moderate(e, review)}>
            <label className="grid gap-1">Interne Notiz (optional)<input name="note" maxLength={500} className={input} /></label>
            {review.status === 'pending' && <>
              <button className={button} name="decision" value="approved" disabled={busy || review.invalidated}>Freigeben</button>
              <button className={button} name="decision" value="rejected" disabled={busy}>Ablehnen</button>
            </>}
            {review.status === 'approved' && <button className={button} name="decision" value="withdrawn" disabled={busy}>Freigabe zurücknehmen</button>}
            {['rejected','withdrawn'].includes(review.status) && !review.invalidated && review.has_proof && <button className={button} name="decision" value="pending" disabled={busy}>Erneut prüfen</button>}
          </form>
        </article>)}
        {more && <button type="button" className={button} disabled={busy} onClick={async () => {
          setBusy(true)
          await load(filter, reviews.at(-1)?.id)
          setBusy(false)
        }}>Mehr anzeigen</button>}
      </>}
    </div>
  </main>
}
