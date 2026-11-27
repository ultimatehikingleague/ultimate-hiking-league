import { supabase } from './supabase'

export type ReviewSummary = {
  score: number | null
  review_count: number
}

export type EventReviewSummary = ReviewSummary & {
  event_id: number
  organizer_slug: string
  organizer_name: string
  category_scores: (number | null)[]
}

export async function eventReviewSummaries(ids: number[]) {
  if (ids.length === 0) return new Map<number, EventReviewSummary>()
  const { data } = await supabase.rpc('uhl_event_review_summaries', { p_events: ids })
  return new Map((data as EventReviewSummary[] | null ?? []).map(row => [row.event_id, row]))
}

export type PublicReview = {
  id: number
  stars: number[]
  comments: (string | null)[]
  author_name: string | null
}

export type ReviewQuery = { before?: string | string[] }

export function reviewCursor(value: ReviewQuery['before']) {
  return typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= BigInt("9223372036854775807") ? value : null
}

export function reviewPagePath(path: string, query: ReviewQuery | undefined) {
  const cursor = reviewCursor(query?.before)
  return cursor ? `${path}?before=${cursor}` : path
}
