'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/app/lib/supabase'
import { reviewCopy } from '@/app/lib/review-copy'
import { reviewPolicyCopy } from '@/app/lib/review-policy-copy'
import ReviewFields, { emptyReviewDraft, reviewOptIn } from './ReviewFields'

type OwnReview = { id: number; status: string; stars: number[]; comments: (string | null)[]; show_name: boolean; pending_revision: boolean; editable: boolean }

export default function ActivityReviewEditor({ recordId, locale }: { recordId: number; locale: string }) {
  const copy = reviewCopy(locale)
  const policy = reviewPolicyCopy(locale)
  const [eventId, setEventId] = useState<number>()
  const [eligible, setEligible] = useState(false)
  const [own, setOwn] = useState<OwnReview>()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(emptyReviewDraft)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    let current = true
    void (async () => {
      const {data} = await supabase.rpc('uhl_activity_review_context', { p_record: recordId })
      const context = data?.[0]
      if (!context) return
      const { data: reviews } = await supabase.rpc('uhl_my_review', { p_event: context.event_id })
      if (!current) return
      setEventId(context.event_id)
      setEligible(context.eligible)
      setOwn(reviews?.[0])
    })()
    return () => { current = false }
  }, [recordId])

  function toggle(open: boolean) {
    if (open && own) setDraft({ stars: own.stars, comments: own.comments.map(comment => comment ?? ''), named: own.show_name })
    setOpen(open)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    event.stopPropagation()
    setBusy(true)
    const content = { p_stars: draft.stars, p_comments: draft.comments, p_show_name: draft.named }
    const { error } = own
      ? await supabase.rpc('uhl_revise_review', { p_review: own.id, ...content })
      : await supabase.rpc('uhl_submit_review', { p_event: eventId, p_record: recordId, ...content })
    if (!error) {
      const { data } = await supabase.rpc('uhl_my_review', { p_event: eventId })
      setOwn(data?.[0])
      setOpen(false)
    }
    setFeedback(error ? error.code === '23505' ? copy.already : copy.error : copy.submitted)
    setBusy(false)
  }

  async function manage(action: 'hide_name' | 'withdraw') {
    if (!own || (action === 'withdraw' && !window.confirm(policy.confirm))) return
    setBusy(true)
    const { error } = await supabase.rpc('uhl_manage_own_review', { p_review: own.id, p_action: action })
    const {data} = !error ? await supabase.rpc('uhl_my_review', { p_event: eventId }) : {data:null}
    if (!error) {
      setOwn(data?.[0])
      setDraft(current => ({...current, named:false}))
      if (action === 'withdraw') setOpen(false)
    }
    setFeedback(error ? copy.error : '')
    setBusy(false)
  }

  if (!eventId || (!eligible && !own)) return null
  return <div className="mt-5 space-y-3 rounded-2xl border border-white/15 p-4">
    {own ? <>
      <p className="font-semibold">{own.pending_revision ? policy.pending : copy.reviews}</p>
      {own.status !== 'withdrawn' && <div className="flex flex-wrap gap-3 text-sm text-amber-200">
        {own.editable && !open && <button type="button" disabled={busy} className="underline" onClick={() => toggle(true)}>{policy.edit}</button>}
        <button type="button" disabled={busy} className="underline" onClick={() => void manage('hide_name')}>{policy.hide}</button>
        <button type="button" disabled={busy} className="underline" onClick={() => void manage('withdraw')}>{policy.withdraw}</button>
      </div>}
    </> : <label className="flex items-center gap-3 font-semibold">
      <input type="checkbox" className="accent-amber-300" checked={open} onChange={event => toggle(event.target.checked)} />
      {reviewOptIn(locale)}
    </label>}
    {open && <form onSubmit={submit} className="space-y-4">
      <ReviewFields locale={locale} value={draft} onChange={setDraft} />
      <div className="flex flex-wrap gap-3">
        <button disabled={busy} className="rounded-xl bg-amber-300 px-4 py-2 font-semibold text-black">{copy.send}</button>
        <button type="button" disabled={busy} onClick={() => toggle(false)} className="underline">{policy.cancel}</button>
      </div>
    </form>}
    {feedback && <p role="status" className="text-sm text-stone-300">{feedback}</p>}
  </div>
}
