import { setRequestLocale } from 'next-intl/server'
import { rankingPageNumber } from '@/app/components/reviews/RankingPage'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import { reviewCopy } from '@/app/lib/review-copy'
import { requireWave1 } from '@/i18n/wave1-boundary'
import Page from '@/app/leaderboard/organizer-reviews/page'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ searchParams }: Parameters<typeof Page>[0]) {
  requireWave1()
  const page = rankingPageNumber((await searchParams).page)
  const path = '/leaderboard/organizer-reviews' + (page > 1 ? `?page=${page}` : '')
  return { ...prototypeMetadata('cs', path), title: reviewCopy('cs').organizers }
}

export default function LocalizedPage(props: Parameters<typeof Page>[0]) {
  requireWave1()
  setRequestLocale('cs')
  return <Page {...props} />
}
