'use client'

import { useEffect, useState, type ReactNode } from 'react'
import GuestReviewInvite from './GuestReviewInvite'
import { reviewCategories, reviewCopy, reviewUiCopy } from '@/app/lib/review-copy'
import type { EventReviewSummary, PublicReview } from '@/app/lib/event-reviews'
import { ReviewBadge, ReviewEntries } from './ReviewDisplay'
import Link from '@/i18n/prototype/LocalizedLink'
import { getReviewProfileReturn } from './ProfileEventReviewLink'

export function ReviewOverviewLink({ children }: { children: ReactNode }) {
  return <a href="#reviews" onClick={() => window.dispatchEvent(new Event('uhl-open-event-reviews'))}
    className="inline-flex w-fit max-w-full shrink-0 justify-center rounded-full border border-amber-300/35 bg-black/30 px-4 py-2 text-center hover:border-amber-300/70">
    {children}
  </a>
}

export default function ReviewPanel({ locale, event, organizer, summary, initialRows, loadError, pagePath, paginated }: {
  locale: string
  event?: number
  organizer?: string
  summary?: EventReviewSummary
  initialRows: PublicReview[]
  loadError?: boolean
  pagePath: string
  paginated?: boolean
}) {
  const copy = reviewCopy(locale)
  const [opened, setOpened] = useState(false)
  const [profileReturn, setProfileReturn] = useState<string | null>(null)
  const rows = initialRows
  const error = Boolean(loadError)
  useEffect(() => {
    if (!event) return
    const openFromHash = () => {
      if (window.location.hash === '#reviews') setOpened(true)
      if (new URLSearchParams(window.location.search).get('fromProfile') !== '1') return
      const target = getReviewProfileReturn(window.location.pathname)
      setProfileReturn(target)
      if (window.location.hash === '#reviews') {
        requestAnimationFrame(() => document.getElementById('reviews')?.scrollIntoView({ block: 'start' }))
      }
    }
    const open = () => setOpened(true)
    openFromHash()
    window.addEventListener('hashchange', openFromHash)
    window.addEventListener('uhl-open-event-reviews', open)
    return () => {
      window.removeEventListener('hashchange', openFromHash)
      window.removeEventListener('uhl-open-event-reviews', open)
    }
  }, [event])

  function reviewsHref(cursor?: number) {
    const query = new URLSearchParams()
    if (cursor !== undefined) query.set('before', String(cursor))
    if (profileReturn) query.set('fromProfile', '1')
    return pagePath + (query.size ? '?' + query.toString() : '') + '#reviews'
  }

  const content = <div className="space-y-5">
    {profileReturn && <a href={profileReturn}
      className="inline-flex rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-amber-200 hover:bg-white/10">
      <span aria-hidden="true" className="me-2">←</span>{reviewUiCopy(locale).back}
    </a>}
    {summary && <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ReviewBadge {...summary} locale={locale} />
        <Link className="text-amber-200 underline" href={`/organizers/${summary.organizer_slug}`}>{summary.organizer_name}</Link>
      </div>
      {!!summary.review_count && <dl className="space-y-3 rounded-2xl border border-white/10 bg-black/15 p-4">
        {reviewCategories.slice(0,6).map((category,index) => {
          const value = Number(summary.category_scores?.[index] ?? 0)
          return <div key={category} className="grid grid-cols-[minmax(0,1fr)_minmax(2rem,1fr)_3.5rem] items-center gap-2 text-sm sm:gap-4">
            <dt className="break-words">{copy[category]}</dt>
            <dd aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-amber-300" style={{width:`${value*20}%`}} /></dd>
            <dd className="text-end tabular-nums text-amber-300">{Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(value)}/5</dd>
          </div>
        })}
      </dl>}
    </>}
    {error && <p role="alert" className="text-red-300">{copy.error}</p>}
    {!rows.length && !error && <p className="text-sm text-stone-300">{copy.empty}</p>}
    <ReviewEntries rows={rows} organizer={Boolean(organizer)} locale={locale} />
    <div className="flex flex-wrap items-center gap-4">
      {paginated && <Link href={reviewsHref()} className="text-sm text-stone-300 underline">↶ {copy.reviews}</Link>}
      {rows.length === 20 && <Link href={reviewsHref(rows.at(-1)?.id)}
        className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2">{copy.more}</Link>}
    </div>
    <GuestReviewInvite locale={locale} />
  </div>
  const panel = 'my-6 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/10 md:p-7'
  return event ? <details id="reviews" open={opened} onToggle={event => setOpened(event.currentTarget.open)} className={panel + ' scroll-mt-5'}>
    <summary className="cursor-pointer text-2xl font-semibold">{copy.reviews}</summary>
    <div className="mt-5">{content}</div>
  </details> : <section id="reviews" className={panel}><h2 className="mb-5 text-2xl font-semibold">{copy.reviews}</h2>{content}</section>
}
