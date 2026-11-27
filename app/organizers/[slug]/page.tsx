import { notFound } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { supabase } from '@/app/lib/supabase'
import { reviewCopy } from '@/app/lib/review-copy'
import { reviewCursor, type PublicReview, type ReviewSummary, type ReviewQuery } from '@/app/lib/event-reviews'
import ReviewPanel from '@/app/components/reviews/ReviewPanel'
import ReviewRankingHero from '@/app/components/reviews/ReviewRankingHero'
import { ReviewBadge } from '@/app/components/reviews/ReviewDisplay'

export const dynamic = 'force-dynamic'

export default async function OrganizerPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams?: Promise<ReviewQuery> }) {
  const [{slug}, locale, query] = await Promise.all([params, getLocale(), searchParams])
  const cursor = reviewCursor(query?.before)
  const copy = reviewCopy(locale)
  const [overview, entries] = await Promise.all([
    supabase.rpc('uhl_organizer_review_summary', { p_slug: slug }),
    supabase.rpc('uhl_public_reviews', { p_organizer: slug, p_event: null, p_before: cursor }),
  ])
  const organizer = (overview.data as (ReviewSummary & { name: string })[] | null)?.[0]
  if (!organizer && !overview.error) notFound()
  return <main className="min-h-screen bg-[#141312] text-stone-100">
    <ReviewRankingHero locale={locale} title={organizer?.name ?? copy.organizer}>
      {organizer && <ReviewBadge {...organizer} locale={locale} />}
    </ReviewRankingHero>
    <div className="mx-auto max-w-5xl px-6 pb-10 md:px-10">
      {organizer ? <ReviewPanel key={slug} locale={locale} organizer={slug}
        pagePath={`/organizers/${encodeURIComponent(slug)}`} paginated={Boolean(cursor)} initialRows={entries.data as PublicReview[] | null ?? []} loadError={Boolean(entries.error)} />
        : <p role="alert" className="pt-6">{copy.error}</p>}
    </div>
  </main>
}
