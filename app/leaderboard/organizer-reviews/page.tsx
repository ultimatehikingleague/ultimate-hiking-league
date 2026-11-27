import RankingPage, { type RankingProps } from '@/app/components/reviews/RankingPage'

export const dynamic = 'force-dynamic'

export default function OrganizerRankings(props: RankingProps) {
  return <RankingPage kind="organizer" {...props} />
}
