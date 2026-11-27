import { setRequestLocale } from 'next-intl/server'
import { rankingPageNumber } from '@/app/components/reviews/RankingPage'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import { reviewCopy } from '@/app/lib/review-copy'
import Page from '@/app/leaderboard/organizer-reviews/page'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ searchParams }: Parameters<typeof Page>[0]) {
  const page = rankingPageNumber((await searchParams).page)
  const path = '/leaderboard/organizer-reviews' + (page > 1 ? `?page=${page}` : '')
  return { ...prototypeMetadata('de', path), title: reviewCopy('de').organizers }
}

export default function LocalizedPage(props: Parameters<typeof Page>[0]) {
  setRequestLocale('de')
  return <Page {...props} />
}
