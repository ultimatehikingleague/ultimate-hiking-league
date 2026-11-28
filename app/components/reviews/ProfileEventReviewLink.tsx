'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import type { ReviewSummary } from '@/app/lib/event-reviews'
import { ReviewBadge } from './ReviewDisplay'

const returnKey = 'uhl-review-profile-return'

export function getReviewProfileReturn(eventPath: string) {
  try {
    const value = JSON.parse(sessionStorage.getItem(returnKey) ?? 'null')
    if (value?.eventPath !== eventPath || typeof value?.profile !== 'string') return null
    const target = new URL(value.profile, window.location.origin)
    if (target.origin !== window.location.origin || target.pathname.startsWith('//') || !/^#review-record-\d+$/.test(target.hash)) return null
    return target.pathname + target.search + target.hash
  } catch {
    return null
  }
}

export default function ProfileEventReviewLink({ summary, slug, recordId, locale }: {
  summary: ReviewSummary; slug: string; recordId: number; locale: string
}) {
  const anchor = `review-record-${recordId}`

  useEffect(() => {
    // The personal profile loads its record cards asynchronously.
    if (window.location.hash === '#' + anchor) {
      document.getElementById(anchor)?.scrollIntoView({ block: 'center' })
    }
  }, [anchor])

  if (summary.score === null || !summary.review_count) return null
  return <Link id={anchor} href={`/${locale}/events/${encodeURIComponent(slug)}?fromProfile=1#reviews`}
    className="mt-2 block w-fit max-w-full rounded-md py-1 hover:underline focus-visible:outline-2 focus-visible:outline-amber-300"
    onClick={event => {
      try {
        sessionStorage.setItem(returnKey, JSON.stringify({
          eventPath: event.currentTarget.pathname,
          profile: window.location.pathname + window.location.search + '#' + anchor,
        }))
      } catch {
        // Standard link navigation remains available if storage is disabled.
      }
    }}>
    <ReviewBadge {...summary} locale={locale} />
  </Link>
}
