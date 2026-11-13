import { normalizeActivityDurationText } from './normalize'
import type { parseActivity } from './parse'

export type SubmittedActivity = {
  activity_date: string
  distance_km: number | null
  actual_distance_km: number | null
  elapsed_time_text: string | null
  elevation_gain: number | null
}

const berlinDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' })

export function activityDateInBerlin(start: string | null) {
  return start === null ? null : berlinDate.format(new Date(start))
}

const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 12 })

export function compareActivity(activity: ReturnType<typeof parseActivity>, submission: SubmittedActivity) {
  const elapsed = normalizeActivityDurationText(submission.elapsed_time_text)
  const distance = submission.actual_distance_km ?? submission.distance_km
  const rows = [
    { parameter: 'Datum (Berlin)', original: activityDateInBerlin(activity.start), submitted: submission.activity_date || null },
    { parameter: 'Distanz (km)', original: activity.distanceKm, submitted: distance },
    { parameter: 'Gesamtzeit', original: activity.elapsed === '00:00' ? null : activity.elapsed,
      submitted: submission.elapsed_time_text?.trim() || null, comparable: elapsed },
    { parameter: 'Aufstieg (m)', original: activity.ascent, submitted: submission.elevation_gain },
  ]

  return rows.map(({ parameter, original, submitted, comparable }) => {
    const comparison = comparable === undefined ? submitted : comparable
    const equal = typeof original === 'number' && typeof comparison === 'number'
      ? Math.abs(original - comparison) <= 1e-9
      : original === comparison
    return {
      parameter,
      original: typeof original === 'number' ? numberFormat.format(original) : original,
      submitted: typeof submitted === 'number' ? numberFormat.format(submitted) : submitted,
      result: original === null ? 'uncertain' : submitted === null ? 'missing' : equal ? 'match' : 'different',
    } as const
  })
}
