'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'

export type Approval = {
  start_on: string
  end_on: string | null
  event_ids: number[]
  approved_at: string
  revoked_at: string | null
  revoke_reason: string | null
}
export type SocialMention = { published_on: string; post_url: string }
type EventOption = { id: number; title: string | null; city: string | null; event_date: string | null }
type Submit = (payload: Record<string, unknown>) => Promise<void>
const field = 'mt-1 block w-full rounded-lg border border-white/20 bg-[#221f1b] px-3 py-2 text-white'
const button = 'rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white disabled:opacity-50'

export default function PlacementApproval({ bookingType, packageCode, approval, social, today, agreedStart, effectiveEnd, eligible, canApprove, busy, submit }: {
  bookingType: 'brand_partner' | 'event_partner'
  packageCode: string
  approval: Approval | null
  social: SocialMention | null
  today: string
  agreedStart?: string
  effectiveEnd?: string | null
  eligible: boolean
  canApprove: boolean
  busy: boolean
  submit: Submit
}) {
  const eventPackage = bookingType === 'event_partner'
  const [events, setEvents] = useState<EventOption[]>([])
  const [eventError, setEventError] = useState('')
  const [selected, setSelected] = useState<number[]>(approval?.event_ids ?? [])
  const approved = !!approval && !approval.revoked_at
  const eventLimit = packageCode === 'D' ? 15 : packageCode === 'C' ? 5 : 1
  const milestone = bookingType === 'brand_partner' && packageCode === 'M'
  const officialBrand = bookingType === 'brand_partner' && packageCode === 'F'

  useEffect(() => {
    if (!eventPackage || (!approved && !eligible)) return
    let mounted = true
    async function load() {
      const rows: EventOption[] = []
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from('events_master')
          .select('id,title,city,event_date').not('slug', 'is', null)
          .order('event_date', { ascending: false }).order('id').range(offset, offset + 499)
        if (error) { if (mounted) setEventError('Die Events konnten nicht geladen werden.'); return }
        rows.push(...data)
        if (data.length < 500) break
      }
      if (mounted) setEvents(rows)
    }
    void load()
    return () => { mounted = false }
  }, [eventPackage, approved, eligible])

  const eventLabel = (event: EventOption) => [event.title || event.city || 'Event ' + event.id, event.event_date].filter(Boolean).join(' · ')
  const submitForm = (event: FormEvent<HTMLFormElement>, action: string) => {
    event.preventDefault()
    void submit({ action, ...Object.fromEntries(new FormData(event.currentTarget)) })
  }
  const end = effectiveEnd === undefined ? approval?.end_on : effectiveEnd
  const state = approval?.revoked_at ? 'Abgeschaltet' : !approved ? 'Freigabe ausstehend'
    : end && end < today ? 'Abgelaufen' : approval.start_on > today ? 'Geplant' : 'Live'

  return (
    <section className="grid gap-3 border-t border-white/10 pt-3">
      <h3 className="font-semibold text-white">{milestone ? 'Präsenzfreigabe' : 'Werbefreigabe'} · {state}</h3>
      {approval?.revoked_at && <p>Abschaltgrund: {approval.revoke_reason}</p>}
      {approved && <p>Ausspielung ab {approval.start_on} · {end ? 'bis ' + end : 'bis Partnerschaftsende'}</p>}
      {!approved && agreedStart && agreedStart < today && (!end || end >= today) &&
        <p className="text-amber-200">Der vereinbarte Start liegt zurück. Die Freigabe verschiebt das vereinbarte Ende nicht.</p>}
      {eventError && <p role="alert" className="text-amber-200">{eventError}</p>}
      {approved && eventPackage && <ul className="list-disc pl-5">{approval.event_ids.map(id => {
        const event = events.find(item => item.id === id)
        return <li key={id}>{event ? eventLabel(event) : 'Event ' + id}</li>
      })}</ul>}
      {approved && (
        <form className="grid max-w-xl gap-2" onSubmit={event => submitForm(event, 'revoke-placement')}>
          <label>Grund für die Abschaltung<input required maxLength={500} name="reason" className={field} /></label>
          <button type="submit" className={button + ' justify-self-start'} disabled={busy}>{milestone ? 'Präsenzfreigabe zurückziehen' : 'Werbefreigabe zurückziehen'}</button>
        </form>
      )}
      {!approved && eligible && canApprove && (
        <div className="grid max-w-xl gap-2">
          {eventPackage && <>
            <label>Events zuordnen ({selected.length}/{eventLimit})
              <select className={field} value="" disabled={selected.length >= eventLimit || busy}
                onChange={event => setSelected(current => [...current, Number(event.target.value)])}>
                <option value="">{events.length === 0 ? 'Events werden geladen …' : 'Event hinzufügen'}</option>
                {events.filter(event => !selected.includes(event.id)).map(event =>
                  <option key={event.id} value={event.id}>{eventLabel(event)}</option>)}
              </select>
            </label>
            {selected.map(id => {
              const event = events.find(item => item.id === id)
              return <div className="flex flex-wrap items-center gap-2" key={id}>
                <span>{event ? eventLabel(event) : 'Event ' + id}</span>
                <button className={button} type="button" disabled={busy}
                  onClick={() => setSelected(current => current.filter(value => value !== id))}>Entfernen</button>
              </div>
            })}
          </>}
          <button type="button" className={button + ' justify-self-start'}
            disabled={busy || (eventPackage && selected.length === 0)}
            onClick={() => void submit({ action: 'approve-placement', eventIds: selected })}>{milestone ? 'Präsenz freigeben' : 'Werbung freigeben'}</button>
        </div>
      )}
      {officialBrand && (social ? (
        <p>Social-Erwähnung vom {social.published_on} · <a className="underline" href={social.post_url} target="_blank" rel="noopener noreferrer">Beitrag öffnen</a></p>
      ) : eligible && (
        <form className="grid max-w-xl gap-2" onSubmit={event => submitForm(event, 'record-social')}>
          <label>Link zum veröffentlichten Social-Beitrag<input className={field} name="url" type="url" required maxLength={750} /></label>
          <label>Veröffentlicht am<input className={field} name="date" type="date" max={today} required /></label>
          <button type="submit" className={button + ' justify-self-start'} disabled={busy}>Social-Erwähnung dokumentieren</button>
        </form>
      ))}
      {eventPackage && (packageCode === 'C' || packageCode === 'D') && <p className="text-stone-300">Bevorzugte {packageCode === 'C' ? 'Einsendung und Betreuung' : 'Betreuung'} vereinbart.</p>}
    </section>
  )
}
