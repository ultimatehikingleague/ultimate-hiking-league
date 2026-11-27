'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const queuePageSize = 30

export default function EventReviewsTile() {
  const [pending, setPending] = useState(0)

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
          setPending(0)
          return
        }
        const rows = data as { id: number }[]
        for (const { id } of rows) ids.add(id)
        if (rows.length < queuePageSize) {
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
      {pending > 0 && (
        <span className="absolute -right-1.5 -top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-red-700 px-1.5 text-xs font-bold tabular-nums text-white ring-2 ring-[#141312]">
          {pending}<span className="sr-only"> ausstehende Bewertungsfreigaben</span>
        </span>
      )}
    </Link>
  )
}
