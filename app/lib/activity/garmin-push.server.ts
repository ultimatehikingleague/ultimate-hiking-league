import { garminHikingTypes } from './garmin-metrics'
import { checkGarminSamples } from './garmin-private-samples'
import { eligibility, fullMinutes } from './normalize'

export const garminActivityFeeds = ['activities', 'activityDetails', 'activityFiles'] as const
export type GarminActivityFeed = typeof garminActivityFeeds[number]



function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined
}

function text(value: unknown, max: number) {
  return typeof value === 'string' && value.length <= max && value.trim() ? value : null
}

function nonnegative(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function flag(value: unknown) {
  return typeof value === 'boolean' ? value : null
}

function originSignal(field: string, summary: Record<string, unknown>, item: Record<string, unknown>) {
  const values = (summary === item ? [summary] : [summary, item])
    .filter(source => Object.hasOwn(source, field)).map(source => source[field])
  if (values.some(value => typeof value !== 'boolean')) return 'invalid'
  if (values.includes(true) && values.includes(false)) return 'conflict'
  return values[0] ?? null
}

function activityId(value: unknown) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value)
  return text(value, 128)
}

function detailElapsedSeconds(value: unknown) {
  if (!Array.isArray(value)) return null
  let elapsed: number | null = null
  for (const entry of value) {
    const sample = object(entry)
    const clock = nonnegative(sample?.clockDurationInSeconds)
    const timer = nonnegative(sample?.timerDurationInSeconds)
    const moving = nonnegative(sample?.movingDurationInSeconds)
    if (clock === null || !Number.isSafeInteger(clock) || clock <= 0 ||
        (timer !== null && timer > clock) || (moving !== null && moving > (timer ?? clock))) continue
    elapsed = Math.max(elapsed ?? 0, clock)
  }
  return elapsed
}

export function fileCallback(value: unknown) {
  if (typeof value !== 'string' || value.length > 4096) return null
  const url = URL.parse(value)
  if (!url || url.origin !== 'https://apis.garmin.com' ||
      url.pathname !== '/wellness-api/rest/activityFile' || url.username || url.password ||
      url.hash || [...url.searchParams.keys()].length !== 2 ||
      !url.searchParams.get('id') || !url.searchParams.get('token')) return null
  return url.href
}

export function normalizeGarminPush(feed: GarminActivityFeed, payload: unknown) {
  const envelope = object(payload)
  const entries = envelope?.[feed]
  if (!envelope || Object.keys(envelope).length !== 1 || !Array.isArray(entries)) {
    throw new Error('Invalid Garmin push envelope')
  }

  return entries.map(value => {
    const item = object(value)
    const summary = feed === 'activityDetails' ? object(item?.summary) : item
    const userId = text(item?.userId, 256)
    const summaryId = text(item?.summaryId, 256)
    const id = activityId(item?.activityId ?? summary?.activityId)
    if (!userId || !summaryId || !summary || !item) throw new Error('Invalid Garmin push item')

    const type = text(summary.activityType, 80)
    const meters = nonnegative(summary.distanceInMeters)
    const distanceKm = meters === null ? null : meters / 1000
    const ascent = nonnegative(summary.totalElevationGainInMeters)
    const elapsedSeconds = feed === 'activityDetails' ? detailElapsedSeconds(item?.samples) : null
    const start = nonnegative(summary.startTimeInSeconds)
    const offset = summary.startTimeOffsetInSeconds
    const format = summary.fileType
    const file = feed === 'activityFiles'
      ? { format, callbackUrl: fileCallback(summary.callbackURL) }
      : null
    if (file && ((format !== 'FIT' && format !== 'TCX' && format !== 'GPX') || !file.callbackUrl)) {
      throw new Error('Invalid Garmin activity file metadata')
    }

    const startTimeInSeconds = start !== null && Number.isSafeInteger(start) && start <= 253402300799 ? start : null
    const device = text(summary.deviceName, 160)
    const identityConflict = summary !== item && (
      (Object.hasOwn(summary, 'userId') && summary.userId !== userId) ||
      (Object.hasOwn(item, 'activityId') && activityId(item.activityId) !== id) ||
      (Object.hasOwn(summary, 'activityId') && activityId(summary.activityId) !== id) ||
      (Object.hasOwn(item, 'startTimeInSeconds') && item.startTimeInSeconds !== startTimeInSeconds)
    )

    return {
      privateEvidence: {
        identityConflict, startTimeInSeconds, type, device, distanceKm, ascent,
        manual: originSignal('manual', summary, item),
        isWebUpload: originSignal('isWebUpload', summary, item),
        ...(feed === 'activityDetails' && {
          elapsedSeconds,
          sampleCheck: checkGarminSamples(item.samples, startTimeInSeconds, elapsedSeconds),
        }),
      },
      userId, summaryId, activityId: id,
      type,
      supportedType: type !== null && garminHikingTypes.has(type),
      name: text(summary.activityName, 240),
      device,
      startTimeInSeconds,
      startTimeOffsetInSeconds: typeof offset === 'number' && Number.isSafeInteger(offset) && Math.abs(offset) <= 86_400 ? offset : null,
      distanceKm, ascent, elapsedSeconds,
      elapsed: fullMinutes(elapsedSeconds),
      eligibility: eligibility(distanceKm, ascent),
      manual: flag(summary.manual ?? item?.manual),
      isWebUpload: flag(summary.isWebUpload ?? item?.isWebUpload),
      file,
    }
  })
}
