import BrandHeader from '../BrandHeader'
import Link from '@/i18n/prototype/LocalizedLink'
import { getTranslations } from 'next-intl/server'
import LeaderboardSubnav from '../LeaderboardSubnav'
import { reviewCopy } from '@/app/lib/review-copy'
import type { ReactNode } from 'react'

export default async function ReviewRankingHero({ locale, title, children }: { locale: string; title: string; children?: ReactNode }) {
  const t = await getTranslations('ui')
  const copy = reviewCopy(locale)
  return <section className="relative overflow-hidden border-b border-white/10 bg-cover bg-center"
    style={{backgroundImage:"linear-gradient(to bottom, rgba(20,19,18,0.28), rgba(20,19,18,0.82)), url('/leaderboard-hero.png')"}}>
    <div className="mx-auto max-w-6xl px-6 py-12 md:px-10 md:py-16">
      <BrandHeader />
      <Link href="/leaderboard" className="text-sm text-stone-300 hover:text-white">{t('rankings')}</Link>
      <div className="mt-6 max-w-3xl space-y-4 rounded-[2rem] border border-white/10 bg-black/25 p-6 shadow-2xl shadow-black/20 backdrop-blur-sm md:p-8">
        <h1 className="break-words text-4xl font-bold tracking-tight text-white md:text-5xl">{title}</h1>
        {children}
        <LeaderboardSubnav label={copy.rankings} links={[
          { href: '/leaderboard/event-reviews', label: copy.events },
          { href: '/leaderboard/organizer-reviews', label: copy.organizers },
        ]} />
      </div>
    </div>
  </section>
}
