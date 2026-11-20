'use client'

import { useTranslations } from 'next-intl'
import { LiveBrandPlacement } from '../components/PartnerPlacements'
import Link from '@/i18n/prototype/LocalizedLink'
import BrandHeader from '../components/BrandHeader'

const divisions = [
  {
    name: 'Silver',
    slug: 'silver',
    description:
      "silverDescription",
    badgeClass:
      'border border-stone-300/25 bg-stone-300/10 text-stone-100',
  },
  {
    name: 'Gold',
    slug: 'gold',
    description:
      "goldDescription",
    badgeClass:
      'border border-yellow-400/30 bg-yellow-400/12 text-yellow-200',
  },
  {
    name: 'Platinum',
    slug: 'platinum',
    description:
      "speedDescription",
    badgeClass:
      'border border-fuchsia-400/30 bg-fuchsia-400/12 text-fuchsia-200',
  },
] as const

export default function DivisionHubPage() {
  const t = useTranslations('ui')
  return (
    <main className="min-h-screen bg-[#141312] text-stone-100">
      <section
        className="relative overflow-hidden border-b border-white/10"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgba(20,19,18,0.24), rgba(20,19,18,0.82)), url('/division-hero.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="mx-auto max-w-6xl px-6 py-12 md:px-10 md:py-16">
          <BrandHeader />

          <Link
            href="/"
            className="inline-block text-sm text-stone-300 transition hover:text-white"
          >{t("backArrow")}</Link>

          <div className="mt-6 max-w-3xl rounded-[2rem] border border-white/10 bg-black/25 p-6 shadow-2xl shadow-black/20 backdrop-blur-sm md:p-8">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-stone-300">{t("divisions")}</div>

            <h1 className="mt-2 text-4xl font-bold tracking-tight text-white md:text-5xl">{t("leagueStructure")}</h1>

            <p className="mt-3 text-sm leading-6 text-stone-300 md:text-base">{t("divisionChoices")}</p>
          </div>
        </div>
      </section>

      <section className="px-6 py-10 md:px-10 md:py-12">
        <LiveBrandPlacement surface="rankings" />
        <div className="mx-auto max-w-5xl">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">{t("coreDivisions")}</h2>
              <p className="mt-1 text-sm text-stone-400">{t("divisionProfiles")}</p>
            </div>

            <div className="hidden text-xs uppercase tracking-[0.2em] text-stone-500 md:block">{t("divisionHub")}</div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {divisions.map((division) => (
              <Link
                key={division.slug}
                href={`/division/${division.slug}`}
                className="group rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/10 transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div
                  className={`inline-flex rounded-full px-3 py-1.5 text-sm ${division.badgeClass}`}
                >
                  {division.name}
                </div>

                <h2 className="mt-4 text-2xl font-bold text-white">
                  {division.name}{' '}{t("division")}{' '}</h2>

                <p className="mt-3 text-sm leading-6 text-stone-400">
                  {t(division.description)}
                </p>

                <div className="mt-5 text-sm font-medium text-stone-300 transition group-hover:text-white">{t("viewDivision")}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}