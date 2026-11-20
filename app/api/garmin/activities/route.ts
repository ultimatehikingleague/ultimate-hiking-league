import { NextResponse } from 'next/server'
import {
  authenticateGarmin, decryptGarminValue, encryptGarminTokens, garminDigest, GarminIdentityError,
  GarminInvalidGrant, garminResponse, readGarminIdentity, refreshGarminTokens, type exchangeGarminCode,
} from '../../../lib/activity/garmin-connection.server'
import { mergeGarminMetrics, garminSourceSnapshot, garminPrivateReviewFields, type GarminPrivateReview } from '../../../lib/activity/garmin-metrics'

function garminPublicationIssue(metrics: ReturnType<typeof mergeGarminMetrics>, reason?: string) {
  if (metrics.verified) return null
  if (metrics.eligibility === 'exception') return 'Diese Wanderung erreicht weder 10 km noch 600 positive Höhenmeter.'
  if (metrics.manual || metrics.isWebUpload || reason === 'manual-true' || reason === 'isWebUpload-true') {
    return 'Manuell erstellte oder hochgeladene Aktivitäten sind von der Direktveröffentlichung ausgeschlossen.'
  }
  if (metrics.distanceKm == null) return 'Garmin hat keine Distanz übermittelt.'
  if (metrics.ascent == null) return 'Garmin hat keinen Aufstieg übermittelt.'
  if (!metrics.elapsed) return 'Garmin hat keine Gesamtzeit übermittelt.'
  switch (reason) {
    case 'not-hiking': return 'Garmin hat die Aktivität nicht als Wanderung erfasst.'
    case 'average-speed-over-15-kmh': return 'Die Durchschnittsgeschwindigkeit liegt über 15 km/h.'
    case 'implausible-ascent-rate': return 'Der Aufstieg liegt über 2.000 Höhenmetern pro Stunde.'
    case 'sample-gps-jump':
    case 'sample-coordinates-invalid':
    case 'sample-time-inconsistent': return 'Die aufgezeichneten Garmin-Streckendaten sind unplausibel.'
    case 'manual-missing':
    case 'isWebUpload-missing':
    case 'missing-feed-pair': return 'Garmin hat die Aktivität noch nicht vollständig bestätigt.'
    case 'measurement-conflict':
    case 'start-time-conflict':
    case 'activity-identity-conflict':
    case 'redelivery-conflict': return 'Die Garmin-Zustellungen enthalten widersprüchliche Angaben.'
    default: return 'Die Garmin-Daten reichen für die automatische Prüfung nicht aus.'
  }
}

const pageSize = 10
const dateSources = ['summary', 'details', 'file_metrics'] as const
type InboxCursor = { date: number | null; id: string }

function readInboxCursor(value: string): InboxCursor {
  if (value.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid inbox cursor')
  const { date, id } = JSON.parse(Buffer.from(value, 'base64url').toString())
  if (typeof id !== 'string' || !id.length || id.length > 256 || id.includes(String.fromCharCode(0)) ||
      (date !== null && (typeof date !== 'number' || !Number.isFinite(date)))) {
    throw new Error('Invalid inbox cursor')
  }
  return { date, id }
}

async function listInboxPage(db: Exclude<Awaited<ReturnType<typeof authenticateGarmin>>, Response>['config']['db'], owner: string, cursor: InboxCursor | null) {
  const sources = cursor?.date === null ? [null] : [...dateSources, null]
  // PostgREST can order by a JSON field, but cannot coalesce fields. Query disjoint
  // groups in date-source priority and merge their bounded lists of IDs.
  const groups = await Promise.all(sources.map(async source => {
    const dateField = source && `${source}->startTimeInSeconds`
    const query = db.from('garmin_activities')
      .select(dateField ? `activity_id, date:${dateField}` : 'activity_id').eq('owner_id', owner)
    for (const previous of dateSources) {
      const textField = `${previous}->>startTimeInSeconds`
      if (previous === source) {
        query.not(textField, 'is', null)
        break
      }
      query.is(textField, null)
    }
    if (dateField) {
      query.order(dateField, { ascending: false })
      if (cursor?.date != null) {
        const id = '"' + cursor.id.replace(/["\\]/g, '\\$&') + '"'
        query.or(`${dateField}.lt.${cursor.date},and(${dateField}.eq.${cursor.date},activity_id.lt.${id})`)
      }
    } else if (cursor?.date === null) {
      query.lt('activity_id', cursor.id)
    }
    const { data, error } = await query.order('activity_id', { ascending: false }).limit(pageSize + 1)
    if (error) throw error
    return (data as unknown as { activity_id: string; date?: number }[])
      .map(({ activity_id, date }) => ({ id: activity_id, date: date ?? null }))
  }))
  const rows = groups.flat().sort((left, right) =>
    (right.date ?? -Infinity) - (left.date ?? -Infinity) ||
    Buffer.compare(Buffer.from(right.id), Buffer.from(left.id)))
  return { rows: rows.slice(0, pageSize), hasMore: rows.length > pageSize }
}

export async function GET(request: Request) {
  try {
    const access = await authenticateGarmin(request)
    if (access instanceof Response) return access
    const { config, owner } = access
    const { data: connection, error } = await config.db.from('garmin_connections').select('garmin_user_id, activity_export_revoked_at')
      .eq('user_id', owner).is('disconnect_lease_until', null).is('deregistered_at', null).maybeSingle()
    if (error) return garminResponse(503)
    const params = new URL(request.url).searchParams
    const view = params.get('view')
    if (view === 'connection') {
      return NextResponse.json({
        connected: Boolean(connection), revoked: Boolean(connection?.activity_export_revoked_at),
      }, { headers: garminResponse(200).headers })
    }
    if (!connection) return NextResponse.json({ connected: false, activities: [] }, { headers: garminResponse(200).headers })
    if (connection.activity_export_revoked_at) {
      return NextResponse.json({ connected: true, revoked: true, activities: [] }, { headers: garminResponse(200).headers })
    }
    let cursor: InboxCursor | null = null
    const rawCursor = params.get('cursor')
    if (rawCursor !== null) {
      try { cursor = readInboxCursor(rawCursor) } catch { return garminResponse(400) }
    }
    const statusOnly = view === 'inbox-status'
    const pushEnabled = process.env.GARMIN_PUSH_ENABLED === 'true'
    const workerEnabled = process.env.GARMIN_WORKER_ENABLED === 'true'
    const submissionEnabled = process.env.GARMIN_SUBMISSION_ENABLED === 'true'
    const [page, pendingResult, failureResult] = await Promise.all([
      statusOnly ? null : listInboxPage(config.db, owner, cursor),
      config.db.from('garmin_push_inbox').select('id')
        .eq('owner_id', owner).is('processed_at', null).limit(1),
      config.db.from('garmin_push_inbox').select('id')
        .eq('owner_id', owner).not('failure', 'is', null)
        .neq('failure', 'unsupported-activity-type').neq('feed', 'activityFiles')
        .gte('processed_at', new Date(Date.now() - 86_400_000).toISOString()).limit(1),
    ])
    if (pendingResult.error || failureResult.error) return garminResponse(503)
    const status = {
      connected: true,
      importStatus: {
        pushEnabled,
        workerEnabled,
        pending: Boolean(pendingResult.data?.length),
        recentFailure: Boolean(failureResult.data?.length),
      },
      submissionEnabled,
    }
    if (!page) return NextResponse.json(status, { headers: garminResponse(200).headers })

    const ids = page.rows.map(row => row.id)
    const [activitiesResult, reviewsResult] = ids.length ? await Promise.all([
      config.db.from('garmin_activities').select('activity_id, summary, details, file_metrics')
        .eq('owner_id', owner).in('activity_id', ids),
      config.db.from('garmin_private_publication_reviews').select(garminPrivateReviewFields)
        .eq('owner_id', owner).in('activity_id', ids),
    ]) : [null, null]
    if (activitiesResult?.error || reviewsResult?.error) return garminResponse(503)
    const activities = new Map(activitiesResult?.data?.map(row => [row.activity_id, row]))
    const reviews = new Map<string, GarminPrivateReview>(reviewsResult?.data?.map(row => [row.activity_id, row]))
    return NextResponse.json({
      ...status,
      nextCursor: page.hasMore ? Buffer.from(JSON.stringify(page.rows.at(-1))).toString('base64url') : null,
      activities: page.rows.flatMap(({ id, date }) => {
        const row = activities.get(id)
        if (!row) return []
        const review = reviews.get(row.activity_id)
        const metrics = mergeGarminMetrics(row.summary, row.details, row.file_metrics, review)
        const reviewKey = garminDigest(JSON.stringify(garminSourceSnapshot(row, review)))
        const publicationIssue = garminPublicationIssue(metrics, review?.reason)
        return [{
          publicationIssue, privateOnly: row.summary.type !== 'HIKING',
          id: row.activity_id, name: metrics.name, device: metrics.device,
          manual: metrics.manual, isWebUpload: metrics.isWebUpload, distanceKm: metrics.distanceKm, ascent: metrics.ascent,
          startTimeInSeconds: date,
          elapsed: metrics.elapsed, eligibility: metrics.eligibility, publishable: Boolean(metrics.verified), reviewKey,
        }]
      }),
    }, { headers: garminResponse(200).headers })
  } catch {
    return garminResponse(503)
  }
}

export async function POST(request: Request) {
  if (process.env.GARMIN_SUBMISSION_ENABLED !== 'true') return garminResponse(404)
  try {
    const access = await authenticateGarmin(request)
    if (access instanceof Response) return access
    const { config, owner } = access
    const id = new URL(request.url).searchParams.get('id')
    if (!id?.trim() || id.length > 128) return garminResponse(400)
    const body = await request.json().catch(() => null)
    if (!body || !Number.isSafeInteger(body.hikerId) || body.hikerId <= 0) return garminResponse(400)

    const kind = body.kind
    if (kind !== 'private' && kind !== 'official_event') return garminResponse(400)
    const event = kind === 'official_event'
    if (event && (typeof body.officialDistanceKm !== 'number' || !Number.isFinite(body.officialDistanceKm) ||
      body.officialDistanceKm <= 0 || typeof body.organizer !== 'string' || body.organizer.length > 240 ||
      (body.eventMasterId != null && (!Number.isSafeInteger(body.eventMasterId) || body.eventMasterId <= 0)))) {
      return garminResponse(400)
    }

    if (typeof body.reviewKey !== 'string' || !/^[a-f0-9]{64}$/.test(body.reviewKey)) return garminResponse(400)
    const date = body.activityDate
    if (typeof date !== 'string' || !/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/.test(date)) return garminResponse(400)
    const timestamp = new Date(date)
    if (!Number.isFinite(timestamp.getTime()) || timestamp.toISOString().slice(0, 10) !== date) return garminResponse(400)
    const fields = { activity_name: 240, description: 240, country: 100, location: 240 } as const
    const annotations: Record<string, string | null> = {}
    for (const [key, limit] of Object.entries(fields)) {
      const value: unknown = key === 'description' ? body[key] ?? '' : body[key]
      if (typeof value !== 'string' || value.length > limit) return garminResponse(400)
      annotations[key] = value.trim() || null
    }

    const { data: connection, error: connectionError } = await config.db.from('garmin_connections')
      .select('garmin_user_id, connected_at, encrypted_tokens').eq('user_id', owner)
      .is('disconnect_lease_until', null).is('deregistered_at', null).is('activity_export_revoked_at', null).maybeSingle()
    if (connectionError) return garminResponse(503)
    if (!connection) return garminResponse(409)

    const { data: activity, error: activityError } = await config.db.from('garmin_activities')
      .select('summary, details, file_metrics').eq('owner_id', owner).eq('activity_id', id).maybeSingle()
    if (activityError) return garminResponse(503)
    if (!activity) return garminResponse(404)
    const { data: review, error: reviewError } = await config.db.from('garmin_private_publication_reviews')
      .select(garminPrivateReviewFields).eq('owner_id', owner).eq('activity_id', id).maybeSingle()
    if (reviewError) return garminResponse(503)
    const snapshot = garminSourceSnapshot(activity, review)
    if (garminDigest(JSON.stringify(snapshot)) !== body.reviewKey) return garminResponse(409)
    const metrics = mergeGarminMetrics(activity.summary, activity.details, activity.file_metrics, review).verified
    if (!metrics) return garminResponse(422)
    if (event && (activity.summary.type !== 'HIKING' || !annotations.activity_name ||
      metrics.distanceKm < body.officialDistanceKm * 0.97)) return garminResponse(422)

    // COMMON delivery is separate. Verify the current Garmin grant at publication time.
    try {
      let tokens: Awaited<ReturnType<typeof exchangeGarminCode>> =
        JSON.parse(decryptGarminValue(config.tokenKey, owner, connection.encrypted_tokens))
      if (tokens.accessExpiresAt <= Date.now()) {
        tokens = await refreshGarminTokens(config, tokens.refreshToken)
        const saved = await config.db.from('garmin_connections')
          .update({ encrypted_tokens: encryptGarminTokens(config.tokenKey, owner, tokens) })
          .eq('user_id', owner).eq('connected_at', connection.connected_at)
          .eq('encrypted_tokens', connection.encrypted_tokens)
          .is('disconnect_lease_until', null).is('deregistered_at', null).is('activity_export_revoked_at', null)
          .select('user_id').maybeSingle()
        if (saved.error) return garminResponse(503)
        if (!saved.data) return garminResponse(409)
      }
      const identity = await readGarminIdentity(tokens.accessToken)
      if (identity.userId !== connection.garmin_user_id || !identity.canExportActivities) return garminResponse(409)
    } catch (error) {
      if (error instanceof GarminInvalidGrant || (error instanceof GarminIdentityError &&
          error.failures.some(({ failure }) => failure.kind === 'http' && [401, 403, 404].includes(failure.httpStatus)))) {
        return garminResponse(409)
      }
      return garminResponse(503)
    }

    const { data, error } = await config.db.rpc('publish_garmin_activity', {
      p_owner: owner,
      p_hiker_id: body.hikerId,
      p_activity_id: id,
      p_connection_id: connection.garmin_user_id,
      p_connected_at: connection.connected_at,
      p_expected: snapshot,
      p_metadata: {
        ...annotations, activity_date: date, submission_type: kind,
        ...(event && { official_distance_km: body.officialDistanceKm, organizer: body.organizer.trim(),
          event_master_id: body.eventMasterId ?? null }),
      },
    })
    if (error) return garminResponse(error.code === '23505' ? 409 : 503)
    switch (data) {
      case 'submitted': return garminResponse(202)
      case 'duplicate-kind': return garminResponse(409)
      case 'published': return garminResponse(201)
      case 'already-published': return event ? garminResponse(409) : garminResponse(200)
      case 'changed': return garminResponse(409)
      case 'not-found': return garminResponse(404)
      case 'revoked': return garminResponse(409)
      case 'ineligible': return garminResponse(422)
      default: return garminResponse(503)
    }
  } catch {
    return garminResponse(503)
  }
}
