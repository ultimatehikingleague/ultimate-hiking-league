import { eligibility, fullMinutes } from './normalize'

export const garminHikingTypes = new Set(['HIKING', 'WALKING', 'CASUAL_WALKING', 'SPEED_WALKING'])

export type GarminMetrics = {
  type?: string
  name?: string
  device?: string
  startTimeInSeconds?: number
  distanceKm?: number
  ascent?: number
  elapsedSeconds?: number
  fitVerified?: boolean
  fitElapsedSeconds?: number
  fitStartTime?: number
  manual?: boolean
  isWebUpload?: boolean
  warnings?: string[]
}

export const garminPrivateReviewFields = 'activity_id, status, reason, evidence, conflicting_feeds'

export type GarminPrivateReview = {
  status: string
  reason?: string
  evidence: {
    activities?: GarminMetrics
    activityDetails?: GarminMetrics & { sampleCheck?: string }
    activityFiles?: GarminMetrics
  }
  conflicting_feeds: string[]
}

// Shift the decimal representation before rounding so ties such as 9.995
// behave like PostgreSQL numeric rounding instead of binary multiplication.
function roundGarminMeasurement(value: number | undefined, places: number) {
  if (value == null || !Number.isFinite(value) || value < 0) return undefined
  const [coefficient, exponent = '0'] = String(value).split('e')
  const shifted = Number(`${coefficient}e${Number(exponent) + places}`)
  return Number.isFinite(shifted) ? Math.round(shifted) / 10 ** places : undefined
}

export function mergeGarminMetrics(
  summary: GarminMetrics, details: GarminMetrics, file: GarminMetrics, review?: GarminPrivateReview | null,
) {
  // Only the Activities summary supplies measurements for publication. The
  // preview can also show fallback data when no verified snapshot is available.
  const distanceKm = roundGarminMeasurement(summary.distanceKm ?? details.distanceKm ?? file.distanceKm, 2)
  const ascent = roundGarminMeasurement(summary.ascent ?? details.ascent ?? file.ascent, 0)
  const values = { ...summary, ...details, ...file, distanceKm, ascent }
  const verified = verifiedSnapshot(summary, details, file, review)
  const elapsedSeconds = verified?.elapsedSeconds ?? review?.evidence.activityDetails?.elapsedSeconds ??
    file.fitElapsedSeconds ?? file.elapsedSeconds ?? details.elapsedSeconds ?? null
  return {
    ...values,
    verified,
    manual: [summary, details, file].some(source => source.manual === true),
    isWebUpload: [summary, details, file].some(source => source.isWebUpload === true),
    elapsed: fullMinutes(elapsedSeconds),
    eligibility: eligibility(values.distanceKm ?? null, values.ascent ?? null),
  }
}

export type GarminInboxActivity = Pick<ReturnType<typeof mergeGarminMetrics>,
  'name' | 'device' | 'manual' | 'isWebUpload' | 'distanceKm' | 'ascent' | 'startTimeInSeconds' | 'elapsed' | 'eligibility'> &
  { id: string; reviewKey: string; publishable: boolean; publicationIssue: string | null }

export function garminSourceSnapshot(
  row: { summary: GarminMetrics; details: GarminMetrics; file_metrics: GarminMetrics },
  review?: GarminPrivateReview | null,
) {
  const snapshot: unknown[] = [row.summary, row.details, row.file_metrics]
  if (review) snapshot.push([review.status, review.evidence, review.conflicting_feeds, review.reason ?? null])
  return snapshot
}

function privateElapsedSeconds(summary: GarminMetrics, file: GarminMetrics, review: GarminPrivateReview) {
  const { activities, activityDetails, activityFiles } = review.evidence
  const elapsed = activityDetails?.elapsedSeconds
  const passedFeedChecks = review.status === 'consistent' || (review.status === 'unresolved' &&
    (review.reason === 'samples-incomplete' || review.reason === 'samples-missing'))
  if (!passedFeedChecks || review.conflicting_feeds.length || !activities ||
      ['sample-time-inconsistent', 'sample-coordinates-invalid', 'sample-gps-jump'].includes(activityDetails?.sampleCheck ?? '') ||
      activityFiles?.manual !== false ||
      activities.type !== summary.type || activities.device !== summary.device ||
      activities.startTimeInSeconds !== summary.startTimeInSeconds ||
      activities.distanceKm !== summary.distanceKm || activities.ascent !== summary.ascent ||
      elapsed == null ||
      (file.fitVerified === true && (file.fitStartTime !== summary.startTimeInSeconds ||
        file.fitElapsedSeconds == null || Math.abs(file.fitElapsedSeconds - elapsed) > 1))) return undefined
  return elapsed
}

function verifiedSnapshot(
  summary: GarminMetrics, details: GarminMetrics, file: GarminMetrics, review?: GarminPrivateReview | null,
) {
  const { type, startTimeInSeconds, distanceKm: rawDistance, ascent: rawAscent } = summary
  const distanceKm = roundGarminMeasurement(rawDistance, 2)
  const ascent = roundGarminMeasurement(rawAscent, 0)
  const elapsedSeconds = review ? privateElapsedSeconds(summary, file, review) : undefined
  if (type !== 'HIKING' || !summary.device?.trim() ||
      [summary, details, file].some(source => source.manual === true || source.isWebUpload === true ||
        (source.type != null && !garminHikingTypes.has(source.type))) ||
      file.warnings?.length ||
      rawDistance == null || rawDistance <= 0 || distanceKm == null ||
      rawAscent == null || ascent == null ||
      eligibility(distanceKm, ascent) !== 'regular' ||
      elapsedSeconds == null || !Number.isFinite(elapsedSeconds) || elapsedSeconds < 60 || elapsedSeconds / 60 > 2_147_483_647 ||
      rawDistance * 3600 > 15 * elapsedSeconds || rawAscent * 3600 > 2000 * elapsedSeconds ||
      startTimeInSeconds == null || !Number.isSafeInteger(startTimeInSeconds) ||
      startTimeInSeconds <= 0 || startTimeInSeconds + elapsedSeconds > Date.now() / 1000 + 1) return null

  return { distanceKm, ascent, elapsedSeconds, startTimeInSeconds }
}
