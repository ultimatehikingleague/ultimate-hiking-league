import { ArrowRight, Star, Trophy } from 'lucide-react'
import Link from '@/i18n/prototype/LocalizedLink'
import { reviewCopy } from '@/app/lib/review-copy'

const headings = {
  de: { hub: 'Veranstaltungen & Veranstalter', calendar: 'Die besten Events & Veranstalter' },
  en: { hub: 'Events & organizers', calendar: 'The best events & organizers' },
  fr: { hub: 'Événements et organisateurs', calendar: 'Les meilleurs événements et organisateurs' },
  nl: { hub: 'Evenementen en organisatoren', calendar: 'De beste evenementen en organisatoren' },
  it: { hub: 'Eventi e organizzatori', calendar: 'I migliori eventi e organizzatori' },
  es: { hub: 'Eventos y organizadores', calendar: 'Los mejores eventos y organizadores' },
  pl: { hub: 'Wydarzenia i organizatorzy', calendar: 'Najlepsze wydarzenia i organizatorzy' },
  cs: { hub: 'Akce a pořadatelé', calendar: 'Nejlepší akce a pořadatelé' },
}

const rankings = [
  { href: '/leaderboard/event-reviews', label: 'events', Icon: Star },
  { href: '/leaderboard/organizer-reviews', label: 'organizers', Icon: Trophy },
] as const

export default function ReviewRankingCards({ locale, placement }: {
  locale: string
  placement: 'hub' | 'calendar'
}) {
  const copy = reviewCopy(locale)
  const heading = (headings[locale as keyof typeof headings] ?? headings.en)[placement]
  const headingId = 'review-ranking-cards-heading'
  const compact = placement === 'calendar'

  return (
    <section aria-labelledby={headingId} className={compact ? 'mb-6' : 'mt-10 md:mt-12'}>
      <h2 id={headingId} className={compact ? 'mb-3 text-xl font-bold text-white' : 'mb-5 text-2xl font-bold text-white'}>
        {heading}
      </h2>
      <nav aria-labelledby={headingId} className="grid auto-rows-fr gap-3 sm:grid-cols-2 md:gap-4">
        {rankings.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={`group flex min-w-0 items-center gap-3 border border-white/10 bg-white/[0.04] shadow-xl shadow-black/10 transition duration-300 hover:border-amber-300/35 hover:bg-white/[0.07] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300 motion-safe:hover:-translate-y-0.5 ${compact ? 'rounded-2xl p-4' : 'rounded-[2rem] p-5 md:gap-4 md:p-6'}`}
          >
            <span className={`grid shrink-0 place-items-center rounded-xl border border-amber-300/25 bg-amber-300/10 text-amber-200 ${compact ? 'size-9' : 'size-11'}`}>
              <Icon aria-hidden="true" className={compact ? 'size-[18px]' : 'size-5'} />
            </span>
            <span className={`min-w-0 grow wrap-break-word font-bold text-white ${compact ? 'text-base' : 'text-lg md:text-xl'}`}>
              {copy[label]}
            </span>
            <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-stone-400 transition-colors group-hover:text-amber-200" />
          </Link>
        ))}
      </nav>
    </section>
  )
}
