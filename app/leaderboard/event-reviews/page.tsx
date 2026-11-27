import RankingPage, { type RankingProps } from '@/app/components/reviews/RankingPage'

export const dynamic = 'force-dynamic'

export default function EventRankings(props: RankingProps) {
  return <RankingPage kind="series" {...props} />
}
