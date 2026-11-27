import { reviewCategories, reviewCopy } from '@/app/lib/review-copy'
import type { PublicReview, ReviewSummary } from '@/app/lib/event-reviews'

export function ReviewBadge({ score, review_count, locale, stacked = false }: ReviewSummary & { locale: string; stacked?: boolean }) {
  if (score === null || !review_count) return null
  const copy = reviewCopy(locale)
  const rating = Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(score)
  return (
    <span className={`inline-flex items-center text-sm text-stone-300 ${stacked ? "flex-col gap-y-1 text-center" : "flex-wrap gap-x-2"}`}>
      <span className="font-semibold text-amber-300"><span aria-hidden="true">★</span> {rating}/5 <span className="sr-only">{copy.score}</span></span>
      <span>{Intl.NumberFormat(locale).format(review_count)} {copy.count}</span>
    </span>
  )
}

export function ReviewEntries({ rows, locale, organizer = false }: { rows: PublicReview[]; locale: string; organizer?: boolean }) {
  const copy = reviewCopy(locale)
  const categories = organizer ? reviewCategories.slice(6) : reviewCategories.slice(0, 6)
  return <div className="grid gap-4">{rows.map(row => {
    const score = organizer ? Number(row.stars[0]) : row.stars.reduce((sum, value) => sum + Number(value), 0) / 6
    return <article key={row.id} className="min-w-0 rounded-2xl border border-white/10 bg-black/15 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="break-words text-sm font-semibold">{row.author_name || copy.anonymous} <span className="ms-2 font-normal text-emerald-300">✓ {copy.verified}</span></p>
        <p className="font-semibold tabular-nums text-amber-300">★ {Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(score)}/5</p>
      </div>
      <dl className="mt-3 divide-y divide-white/10">
        {categories.map((category, index) => (
          <div key={category} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 py-2">
            <dt className="break-words text-sm text-stone-300">{copy[category]}</dt>
            <dd className="whitespace-nowrap text-amber-300" aria-label={`${row.stars[index]}/5 ${copy.score}`}>
              <span aria-hidden="true">{'★'.repeat(row.stars[index])}{'☆'.repeat(5-row.stars[index])}</span>
            </dd>
            {row.comments[index] && <dd className="col-span-2 whitespace-pre-wrap break-words text-sm text-stone-200">{row.comments[index]}</dd>}
          </div>
        ))}
      </dl>
    </article>
  })}</div>
}
