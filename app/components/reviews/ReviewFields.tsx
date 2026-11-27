'use client'

import { useId } from 'react'
import { reviewCategories, reviewCopy } from '@/app/lib/review-copy'
import { reviewPolicyCopy } from '@/app/lib/review-policy-copy'
import Link from '@/i18n/prototype/LocalizedLink'

export type ReviewDraft = { stars: number[]; comments: string[]; named: boolean }
export const emptyReviewDraft = () => ({ stars: Array<number>(7).fill(0), comments: Array<string>(7).fill(''), named: false })

export function reviewOptIn(locale: string) {
  return ({ de: 'Ich möchte diese Veranstaltung bewerten.', en: 'I would like to review this event.', fr: 'Je souhaite évaluer cet événement.', nl: 'Ik wil dit evenement beoordelen.', it: 'Vorrei recensire questo evento.', es: 'Quiero valorar este evento.', pl: 'Chcę ocenić to wydarzenie.', cs: 'Chci ohodnotit tuto akci.' })[locale] ?? 'I would like to review this event.'
}

export default function ReviewFields({ locale, value, onChange }: { locale: string; value: ReviewDraft; onChange: (next: ReviewDraft) => void }) {
  const copy = reviewCopy(locale)
  const policy = reviewPolicyCopy(locale)
  const fieldId = useId()
  return <div className="space-y-4">
    <details className="text-sm text-stone-300">
      <summary className="cursor-pointer">{policy.guidelines}</summary>
      <p className="mt-2">{policy.rules}</p>
      <Link className="mt-2 inline-block underline" href="/datenschutz#event-reviews">{policy.privacyLabel}</Link>
    </details>
    {reviewCategories.map((category, index) => (
      <fieldset key={category} className={index === 6 ? 'rounded-2xl border border-amber-300/30 bg-amber-300/5 p-4' : 'min-w-0 border-b border-white/10 pb-4'}>
        <legend className="pr-2 font-semibold">{copy[category]}</legend>
        <div className="mb-2 flex gap-1">
          {[1, 2, 3, 4, 5].map(star => <label key={star} className="cursor-pointer">
            <input type="radio" className="peer sr-only" name={fieldId + category} required checked={value.stars[index] === star}
              aria-label={`${star}/5 ${copy.score}`} onChange={() => onChange({ ...value, stars: value.stars.map((score, i) => i === index ? star : score) })} />
            <span aria-hidden="true" className={`inline-block rounded px-1 text-3xl peer-focus-visible:ring-2 peer-focus-visible:ring-white ${star <= value.stars[index] ? 'text-amber-300' : 'text-stone-400'}`}>
              {star <= value.stars[index] ? '★' : '☆'}
            </span>
          </label>)}
        </div>
        <label className="block text-sm text-stone-300">{copy.comment} ({copy.optional})
          <textarea rows={2} value={value.comments[index]} className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 p-2 text-white"
            onChange={event => {
              const comment = Array.from(event.target.value).slice(0, 500).join('')
              onChange({ ...value, comments: value.comments.map((text, i) => i === index ? comment : text) })
            }} />
        </label>
        <div className="text-end text-xs text-stone-400">{Array.from(value.comments[index]).length}/500</div>
      </fieldset>
    ))}
    <label className="flex gap-2 text-sm"><input type="checkbox" className="accent-amber-300" checked={value.named}
      onChange={event => onChange({ ...value, named: event.target.checked })} />{copy.named}</label>
  </div>
}
