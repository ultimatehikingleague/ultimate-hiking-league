import { getLocale } from 'next-intl/server'
import Link from '@/i18n/prototype/LocalizedLink'
import { supabase } from '@/app/lib/supabase'
import { reviewCopy } from '@/app/lib/review-copy'
import { ReviewBadge } from './ReviewDisplay'
import ReviewRankingHero from './ReviewRankingHero'
import GuestReviewInvite from './GuestReviewInvite'

export type RankingProps = { searchParams: Promise<{ page?: string | string[] }> }

export function rankingPageNumber(value: string | string[] | undefined) {
  const number = typeof value === 'string' && /^[1-9][0-9]*$/.test(value) ? Number(value) : 1
  return Number.isSafeInteger(number) && number <= 10000 ? number : 1
}

type RankingRow = {
  rank_number: number
  slug: string
  name: string
  score: number
  review_count: number
  event_slug: string | null
}

export default async function RankingPage({ kind, searchParams }: RankingProps & { kind: 'series' | 'organizer' }) {
  const [locale, query] = await Promise.all([getLocale(), searchParams])
  const copy = reviewCopy(locale)
  const page = rankingPageNumber(query.page)
  const route = kind === 'series' ? '/leaderboard/event-reviews' : '/leaderboard/organizer-reviews'
  const {data, error} = await supabase.rpc('uhl_review_rankings', { p_kind: kind, p_offset: 50 * (page - 1) })
  const rows = data as RankingRow[] | null

  return <main className="min-h-screen bg-[#141312] text-stone-100">
    <ReviewRankingHero locale={locale} title={kind === 'series' ? copy.events : copy.organizers} />
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-10 md:px-10">
      {error && <p role="alert">{copy.error}</p>}
      {!error && !rows?.length && <p className="text-stone-300">{copy.rankEmpty}</p>}
      {rows?.length ? <ol className="space-y-2">{rows.map(row => (
        <li key={row.slug}>
          <Link className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 transition hover:border-white/20 hover:bg-white/[0.08]" href={row.event_slug ? `/events/${row.event_slug}#reviews` : `/organizers/${row.slug}`}>
            <span className="min-w-0 break-words font-semibold">
              <span className="me-4 inline-block min-w-8 tabular-nums text-stone-300">{row.rank_number}.</span>{row.name}
            </span>
            <ReviewBadge {...row} locale={locale} />
          </Link>
        </li>
      ))}</ol> : null}
      <nav className="flex flex-wrap gap-4 text-amber-200">
        {page > 1 && <Link href={`${route}?page=${page - 1}`} aria-label={String(page - 1)}>← {page - 1}</Link>}
        {rows?.length === 50 && page < 10000 && <Link href={`${route}?page=${page + 1}`}>{copy.more} →</Link>}
      </nav>
      <GuestReviewInvite locale={locale} />
    </div>
  </main>
}
