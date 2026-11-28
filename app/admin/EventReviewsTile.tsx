'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { reviewUiCopy } from '../lib/review-copy'
import { supabase } from '../lib/supabase'

const queuePageSize = 30

export default function EventReviewsTile() {
  const locale = useLocale()
  const copy = reviewUiCopy(locale)
  const [pending, setPending] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  const label = pending === null ? (failed ? copy.unavailable : copy.loading) : copy.pending
  const badge = pending === null ? (failed ? '—' : '…') : new Intl.NumberFormat(locale).format(pending)

  useEffect(() => {
    let request: AbortController | undefined

    async function refresh() {
      request?.abort()
      const controller = new AbortController()
      request = controller
      const ids = new Set<number>()
      let before: number | null = null

      // Read the same queue as moderation, including open revisions of approved reviews.
      while (!controller.signal.aborted) {
        const { data, error } = await supabase
          .rpc('uhl_moderation_queue', { p_status: 'pending', p_before: before })
          .select('id')
          .abortSignal(controller.signal)
        if (controller.signal.aborted) return
        if (error) {
          setFailed(true)
          setPending(null)
          return
        }
        const rows = data as { id: number }[]
        for (const { id } of rows) ids.add(id)
        if (rows.length < queuePageSize) {
          setFailed(false)
          setPending(ids.size)
          return
        }
        before = rows[rows.length - 1].id
      }
    }

    function restore(event: PageTransitionEvent) {
      if (event.persisted) void refresh()
    }

    void refresh()
    window.addEventListener('pageshow', restore)
    return () => {
      request?.abort()
      window.removeEventListener('pageshow', restore)
    }
  }, [])

  return (
    <Link href="/admin/event-reviews" className="relative inline-flex items-center rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-sm font-semibold text-stone-100 hover:bg-white/10">
      Veranstaltungsbewertungen
      <span title={label} role="status" className={`absolute -right-1.5 -top-1.5 grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-bold tabular-nums text-white ring-2 ring-[#141312] ${pending !== null && pending > 0 ? 'bg-red-700' : 'bg-stone-600'}`}>
        <span aria-hidden={pending === null ? true : undefined}>{badge}</span>
        <span className="sr-only"> {label}</span>
      </span>
    </Link>
  )
}
