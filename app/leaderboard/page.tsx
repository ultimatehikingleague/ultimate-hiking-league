'use client'

import Link from 'next/link'
import BrandHeader from '../components/BrandHeader'

const rankingCards = [
  {
    title: 'Overall Ranking',
    href: '/leaderboard/overall',
    description:
      'Die allgemeine Liga-Rangliste aller Hiker nach insgesamt gewerteten Kilometern.',
    badge: 'Overall',
    badgeClass:
      'border border-stone-300/25 bg-stone-300/10 text-stone-100',
  },
  {
    title: 'Länderrangliste',
    href: '/leaderboard/country',
    description:
      'Vergleiche Hiker innerhalb ihrer Nationalität. Länder mit echten Daten erscheinen automatisch.',
    badge: 'Country',
    badgeClass:
      'border border-emerald-400/30 bg-emerald-400/12 text-emerald-200',
  },
  {
    title: 'Skyscraper Ranking',
    href: '/skyscraper',
    description:
      'Die Höhenmeter-Rangliste der Liga. Sichtbar ab mindestens 1500 hm Gesamtleistung.',
    badge: 'Elevation',
    badgeClass:
      'border border-sky-400/30 bg-sky-400/12 text-sky-200',
  },
]

export default function LeaderboardHubPage() {
  return (
    <main className="min-h-screen bg-[#141312] text-stone-100">
      <section
        className="relative overflow-hidden border-b border-white/10"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgba(20,19,18,0.28), rgba(20,19,18,0.82)), url('/leaderboard-hero.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="mx-auto max-w-6xl px-6 py-12 md:px-10 md:py-16">
          <BrandHeader />

          <Link
            href="/"
            className="inline-block text-sm text-stone-300 transition hover:text-white"
          >
            ← Zurück
          </Link>

          <div className="mt-6 max-w-3xl rounded-[2rem] border border-white/10 bg-black/25 p-6 shadow-2xl shadow-black/20 backdrop-blur-sm md:p-8">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-stone-300">
              Ranglisten
            </div>

            <h1 className="mt-2 text-4xl font-bold tracking-tight text-white md:text-5xl">
              Ranking Hub
            </h1>

            <p className="mt-3 text-sm leading-6 text-stone-300 md:text-base">
              Wähle eine Rangliste, um die Liga nach Kilometern, Nationalität oder Höhenmetern zu erkunden.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 py-10 md:px-10 md:py-12">
        <div className="mx-auto max-w-5xl">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Verfügbare Rankings</h2>
              <p className="mt-1 text-sm text-stone-400">
                Weitere Filter-Rankings wie Geschlecht oder Recent Events folgen später.
              </p>
            </div>

            <div className="hidden text-xs uppercase tracking-[0.2em] text-stone-500 md:block">
              Rankings
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rankingCards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="group rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/10 transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div
                  className={`inline-flex rounded-full px-3 py-1.5 text-sm ${card.badgeClass}`}
                >
                  {card.badge}
                </div>

                <h3 className="mt-4 text-2xl font-bold text-white">
                  {card.title}
                </h3>

                <p className="mt-3 text-sm leading-6 text-stone-400">
                  {card.description}
                </p>

                <div className="mt-5 text-sm font-medium text-stone-300 transition group-hover:text-white">
                  Zur Rangliste →
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}