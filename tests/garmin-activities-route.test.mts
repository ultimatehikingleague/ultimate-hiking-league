import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHash } from 'node:crypto'
import { encryptGarminTokens } from '../app/lib/activity/garmin-connection.server'
import { GET, POST } from '../app/api/garmin/activities/route'

test('Garmin members list their own imports and submit only their own eligible activities', async t => {
  const ownerId = '00000000-0000-0000-0000-000000000001'
  const otherId = '00000000-0000-0000-0000-000000000002'
  let otherConnected = false
  const original = process.env
  process.env = {
    ...original, GARMIN_SUBMISSION_ENABLED: 'false', GARMIN_PUSH_ENABLED: 'false', GARMIN_WORKER_ENABLED: 'true', GARMIN_OAUTH_ENABLED: 'true', GARMIN_CLIENT_ID: 'client', GARMIN_CLIENT_SECRET: 'secret',
    GARMIN_REDIRECT_URI: 'https://uhl.example/api/garmin/callback', GARMIN_TOKEN_KEY: Buffer.alloc(32).toString('base64url'),
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
  }
  t.after(() => { process.env = original })
  const activities = [
    { activity_id: '1', summary: { type: 'HIKING', distanceKm: 5, ascent: 300 }, details: { elapsedSeconds: 7260 }, file_metrics: {} },
    { activity_id: '2', summary: { type: 'HIKING', distanceKm: 10, ascent: 300 }, details: { elapsedSeconds: 7260 }, file_metrics: {} },
    { activity_id: '3', summary: { type: 'WALKING', distanceKm: 9.995, ascent: 599.49 }, details: {}, file_metrics: { elapsedSeconds: 10_859, fitVerified: true, fitElapsedSeconds: 10_859, fitStartTime: 1_791_623_602 } },
    { activity_id: '4', summary: { type: 'RUNNING', distanceKm: 10 }, details: {}, file_metrics: {} },
    { activity_id: '5', summary: { type: 'HIKING', distanceKm: 0.91552, ascent: 5.13 }, details: { elapsedSeconds: 4284 }, file_metrics: {} },
  ].map((row, index) => ({ ...row, summary: { ...row.summary, device: 'Garmin', manual: false, isWebUpload: false, startTimeInSeconds: index === 3 ? undefined : 1_791_623_600 + index } }))
  const privateSummary = {
    type: 'HIKING', device: 'Garmin', startTimeInSeconds: 1_791_623_606,
    distanceKm: 9.995, ascent: 599.5, isWebUpload: false,
  }
  const privateActivity = { activity_id: '6', summary: privateSummary, details: {}, file_metrics: {} }
  const review = {
    activity_id: '6', status: 'unresolved', reason: 'samples-incomplete', conflicting_feeds: [],
    evidence: { activities: privateSummary, activityFiles: { manual: false },
      activityDetails: { ...privateSummary, sampleCheck: 'samples-incomplete', elapsedSeconds: 7259 } },
  }
  let withPrivateReview = false
  const extraActivities: { activity_id: string; summary: { startTimeInSeconds?: number }; details: { startTimeInSeconds?: number }; file_metrics: { startTimeInSeconds?: number } }[] = []
  let pagePayloadReads = 0
  const tokens = encryptGarminTokens(Buffer.alloc(32), ownerId, {
    accessToken: 'access', refreshToken: 'refresh', accessExpiresAt: Date.now() + 3600000, refreshExpiresAt: Date.now() + 7200000,
  })
  let providerPermission = true
  let providerId = 'private-identifier'
  let revoked = false
  let insertResult = 'published'
  const writes: Record<string, unknown>[] = []
  let activityReads = 0
  let inboxReads = 0
  let failedFeed = 'activities'
  t.mock.method(globalThis, 'fetch', async (input: string | URL, init: RequestInit) => {
    const url = new URL(input)
    const query = url.searchParams
    if (url.pathname === '/auth/v1/user') {
      const token = new Headers(init.headers).get('authorization')
      return Response.json({ id: token === 'Bearer owner-token' ? ownerId : otherId })
    }
    if (url.hostname === 'apis.garmin.com') {
      assert.equal(new Headers(init.headers).get('authorization'), 'Bearer access')
      if (url.pathname.endsWith('/user/id')) return Response.json({ userId: providerId })
      if (url.pathname.endsWith('/user/permissions')) return Response.json({ permissions: providerPermission ? ['ACTIVITY_EXPORT'] : [] })
    }
    assert.equal(new Headers(init.headers).get('authorization'), 'Bearer service')
    switch (url.pathname.split('/').at(-1)) {
      case 'garmin_connections':
        if (query.get('user_id') === `eq.${otherId}` && otherConnected) {
          return Response.json([{ garmin_user_id: 'other-garmin', connected_at: '2026-11-13T10:00:00Z' }])
        }
        return Response.json(query.get('user_id') === `eq.${ownerId}` &&
          !(revoked && query.get('activity_export_revoked_at') === 'is.null')
          ? [{ garmin_user_id: 'private-identifier', connected_at: '2026-11-13T10:00:00Z', encrypted_tokens: tokens, activity_export_revoked_at: revoked ? '2026-11-13T12:00:00Z' : null }] : [])
      case 'garmin_activities':
        if (query.get('owner_id') === `eq.${otherId}`) return Response.json([])
        activityReads++
        assert.equal(query.get('owner_id'), `eq.${ownerId}`)
        const listed = [...activities, ...(withPrivateReview ? [privateActivity] : []), ...extraActivities]
        const filter = query.get('activity_id')
        if (filter?.startsWith('eq.')) return Response.json(listed.filter(row => `eq.${row.activity_id}` === filter))
        if (filter?.startsWith('in.')) {
          const rows = listed.filter(row => filter.slice(4, -1).split(',').includes(row.activity_id))
          assert.ok(rows.length <= 10)
          pagePayloadReads++
          return Response.json(rows)
        }
        assert.equal(query.get('limit'), '11')
        const order = query.get('order') ?? ''
        assert.match(order, /activity_id\.desc$/)
        const source = query.get('select')?.match(/date:(summary|details|file_metrics)->/)?.[1] ?? null
        const after = query.get('or')?.match(/\.lt\.([0-9]+),and\(.*activity_id\.lt\."([^"]+)"\)\)$/)
        if (query.has('or')) assert.ok(after)
        const rows = listed.flatMap(row => {
          const values = row as typeof extraActivities[number]
          const found = (['summary', 'details', 'file_metrics'] as const)
            .find(field => values[field].startTimeInSeconds != null) ?? null
          if (source !== found) return []
          const date = found ? values[found].startTimeInSeconds! : null
          if (after && (date! > Number(after[1]) || (date === Number(after[1]) && row.activity_id >= after[2]))) return []
          if (filter?.startsWith('lt.') && row.activity_id >= filter.slice(3)) return []
          return [{ activity_id: row.activity_id, date }]
        }).sort((a, b) => (b.date ?? -1) - (a.date ?? -1) || b.activity_id.localeCompare(a.activity_id))
        return Response.json(rows.slice(0, 11))
      case 'garmin_private_reviews':
        assert.equal(query.get('owner_id'), `eq.${ownerId}`)
        return Response.json(withPrivateReview && (!query.get('activity_id')?.startsWith('eq.') || query.get('activity_id') === 'eq.6') ? [review] : [])
      case 'publish_garmin_activity':
        writes.push(JSON.parse(init.body as string))
        return Response.json(insertResult)
      case 'garmin_push_inbox':
        if (query.get('owner_id') === `eq.${otherId}`) return Response.json([])
        inboxReads++
        assert.equal(query.get('owner_id'), `eq.${ownerId}`)
        assert.equal(query.get('select'), 'id')
        assert.equal(query.get('limit'), '1')
        if (query.get('processed_at') === 'is.null') return Response.json([{ id: 1 }])
        assert.match(query.get('processed_at') ?? '', /^gte\./)
        assert.equal(query.getAll('failure').includes('neq.unsupported-activity-type'), true)
        assert.equal(query.get('feed'), 'neq.activityFiles')
        return Response.json(failedFeed === 'activityFiles' ? [] : [{ id: 2 }])
      default:
        assert.fail(url.pathname)
    }
  })
  const endpoint = 'https://uhl.example/api/garmin/activities'
  const reviewKey = (id: string) => {
    const activity = activities.find(row => row.activity_id === id)
    return createHash('sha256')
      .update(JSON.stringify(activity ? [activity.summary, activity.details, activity.file_metrics] : []))
      .digest('hex')
  }
  const request = (method: string, id = '', owner = true, origin = 'https://uhl.example', key = reviewKey(id)) =>
    new Request(`${endpoint}?id=${id}`, {
      method, headers: { Origin: origin, Authorization: owner ? 'Bearer owner-token' : 'Bearer other-token' },
      body: method === 'POST' ? JSON.stringify({ hikerId: 42, activity_name: ' Titel ', activityDate: '2026-10-11', reviewKey: key, description: ' Test ', location: '', country: '', distance_km: 999, is_public: true, status: 'approved' }) : undefined,
    })
  assert.equal((await GET(new Request(endpoint))).status, 401)
  assert.equal((await POST(request('POST', '2', false))).status, 404)
  assert.deepEqual(await (await GET(request('GET', '', false))).json(), { connected: false, activities: [] })
  const status = (token: string) => GET(new Request(`${endpoint}?view=connection`, {
    headers: { Authorization: `Bearer ${token}` },
  }))
  assert.deepEqual(await (await status('other-token')).json(), { connected: false, revoked: false })
  assert.deepEqual(await (await status('owner-token')).json(), { connected: true, revoked: false })
  assert.equal(activityReads, 0)
  assert.equal(inboxReads, 0)
  const listing = await GET(request('GET'))
  assert.equal(listing.headers.get('cache-control'), 'no-store')
  const data = await listing.json()
  assert.deepEqual(data.importStatus, {
    pushEnabled: false, workerEnabled: true, pending: true, recentFailure: true,
  })
  assert.equal(inboxReads, 2)
  assert.deepEqual(data.activities.map((row: { id: string }) => row.id), ['5', '3', '2', '1', '4'])
  const [shortHike, eligibleHike] = data.activities
  assert.equal(shortHike.distanceKm, 0.92)
  assert.equal(shortHike.ascent, 5)
  assert.equal(shortHike.elapsed, '01:11')
  assert.equal(shortHike.eligibility, 'exception')
  assert.equal(shortHike.publishable, false)
  assert.match(shortHike.publicationIssue, /weder 10 km noch 600/)
  assert.match(data.activities.at(-1).publicationIssue, /keinen Aufstieg/)
  failedFeed = 'activityFiles'
  assert.equal((await (await GET(request('GET'))).json()).importStatus.recentFailure, false)
  assert.deepEqual(data.activities.slice(1, 4).map((row: { eligibility: string }) => row.eligibility), ['regular', 'regular', 'exception'])
  assert.equal(eligibleHike.elapsed, '03:00')
  assert.equal(eligibleHike.distanceKm, 10)
  assert.equal(eligibleHike.ascent, 599)
  assert.equal(eligibleHike.publishable, false)
  assert.ok(!JSON.stringify(data).includes('private-identifier'))
  assert.equal((await POST(request('POST', '2'))).status, 404)
  process.env.GARMIN_SUBMISSION_ENABLED = 'true'
  assert.equal((await POST(request('POST', '2', false))).status, 409)
  otherConnected = true
  const otherInbox = await (await GET(request('GET', '', false))).json()
  assert.equal(otherInbox.connected, true)
  assert.deepEqual(otherInbox.activities, [])
  assert.equal((await POST(request('POST', '2', false))).status, 404)
  assert.equal(writes.length, 0)
  assert.equal((await POST(request('POST', '2', true, 'https://other.example'))).status, 403)
  assert.equal((await POST(request('POST', 'unknown'))).status, 404)
  assert.equal((await POST(request('POST', '1'))).status, 422)
  assert.equal((await POST(request('POST', '5'))).status, 422)
  assert.equal((await POST(request('POST', '4'))).status, 422)
  assert.equal((await POST(request('POST', '2'))).status, 422)
  assert.equal((await POST(request('POST', '3', true, 'https://uhl.example', '0'.repeat(64)))).status, 409)
  withPrivateReview = true
  insertResult = 'published'
  const { activities: [verifiedByFeeds] } = await (await GET(request('GET'))).json()
  assert.equal(verifiedByFeeds.id, '6')
  assert.equal(verifiedByFeeds.elapsed, '02:00')
  assert.equal(verifiedByFeeds.publishable, true)
  assert.equal('evidence' in verifiedByFeeds, false)
  const submitPrivate = (key: string) => POST(request('POST', '6', true, 'https://uhl.example', key))
  providerPermission = false
  assert.equal((await submitPrivate(verifiedByFeeds.reviewKey)).status, 409)
  providerPermission = true
  providerId = 'wrong-garmin-account'
  assert.equal((await submitPrivate(verifiedByFeeds.reviewKey)).status, 409)
  providerId = 'private-identifier'
  assert.equal(writes.length, 0)
  assert.equal((await submitPrivate(verifiedByFeeds.reviewKey)).status, 201)
  insertResult = 'already-published'
  assert.equal((await submitPrivate(verifiedByFeeds.reviewKey)).status, 200)
  assert.deepEqual(writes[0], writes[1])
  assert.equal(writes[0].p_owner, ownerId)
  assert.equal(writes[0].p_hiker_id, 42)
  assert.deepEqual(writes[0].p_metadata, {
    activity_name: 'Titel', description: 'Test', country: null, location: null, activity_date: '2026-10-11',
  })
  assert.deepEqual(writes.at(-1)?.p_expected, [
    privateSummary, {}, {}, [review.status, review.evidence, review.conflicting_feeds, review.reason],
  ])
  review.reason = 'manual-missing'
  assert.equal((await submitPrivate(verifiedByFeeds.reviewKey)).status, 409)
  const { activities: [unresolved] } = await (await GET(request('GET'))).json()
  assert.equal(unresolved.publishable, false)
  assert.equal((await submitPrivate(unresolved.reviewKey)).status, 422)
  const extraRows = Array.from({ length: 57 }, (_, index) => {
    const id = String(100 + index)
    const date = index < 42 ? 1_791_623_000 + Math.floor(index / 14) : undefined
    const source = (['summary', 'details', 'file_metrics'] as const)[index % 3]
    const row: typeof extraActivities[number] = { activity_id: id, summary: {}, details: {}, file_metrics: {} }
    row[source].startTimeInSeconds = date
    return { row, id, date }
  })
  extraActivities.push(...extraRows.map(({ row }) => row))
  const getPage = (cursor: string | null, token = 'owner-token', view?: string) => {
    const url = new URL(endpoint)
    if (cursor) url.searchParams.set('cursor', cursor)
    if (view) url.searchParams.set('view', view)
    return GET(new Request(url, { headers: { Authorization: `Bearer ${token}` } }))
  }
  const first = await (await getPage(null)).json()
  assert.equal(first.activities.length, 10)
  assert.ok(first.nextCursor)
  assert.deepEqual((await (await getPage(first.nextCursor, 'other-token')).json()).activities, [])
  const readsBeforeStatus = pagePayloadReads
  assert.equal((await (await getPage(null, 'owner-token', 'inbox-status')).json()).activities, undefined)
  assert.equal(pagePayloadReads, readsBeforeStatus)
  assert.equal((await getPage('bogus')).status, 400)
  const paged = [...first.activities]
  let cursor: string | null = first.nextCursor
  for (let index = 0; cursor && index < 7; index++) {
    const response = await getPage(cursor)
    assert.equal(response.status, 200)
    const page = await response.json()
    assert.ok(page.activities.length <= 10)
    paged.push(...page.activities)
    cursor = page.nextCursor
  }
  assert.equal(cursor, null)
  const expected = [
    ...activities.map(({ activity_id: id, summary }) => ({ id, date: summary.startTimeInSeconds })),
    { id: privateActivity.activity_id, date: privateSummary.startTimeInSeconds },
    ...extraRows,
  ].sort((a, b) => (b.date ?? -1) - (a.date ?? -1) || b.id.localeCompare(a.id))
  assert.deepEqual(paged.map(({ id }) => id), expected.map(({ id }) => id))
  const readsBeforeRevoke = inboxReads
  revoked = true
  assert.deepEqual(await (await status('owner-token')).json(), { connected: true, revoked: true })
  assert.deepEqual(await (await GET(request('GET'))).json(), { connected: true, revoked: true, activities: [] })
  assert.equal(inboxReads, readsBeforeRevoke)
  assert.equal((await POST(request('POST', '3'))).status, 409)
})

test('Garmin publication accepts incomplete GPS evidence and qualifies with rounded measurements', async () => {
  const { mergeGarminMetrics } = await import('../app/lib/activity/garmin-metrics')
  const base = {
    type: 'HIKING', startTimeInSeconds: 1_791_623_600, device: 'Garmin', manual: false, isWebUpload: false,
    distanceKm: 10, ascent: 0,
  }
  const fit = { fitVerified: true, fitElapsedSeconds: 7_259, fitStartTime: base.startTimeInSeconds }
  const verifiedReview = (source: typeof base) => ({
    status: 'unresolved', reason: 'samples-incomplete', conflicting_feeds: [],
    evidence: { activities: source, activityFiles: { manual: false },
      activityDetails: { ...source, elapsedSeconds: 7259, sampleCheck: 'samples-incomplete' } },
  })
  const metrics = (fields: Partial<typeof base>, file = fit) => {
    const source = { ...base, ...fields }
    return mergeGarminMetrics(source, {}, file, verifiedReview(source)).verified
  }

  assert.equal(metrics({ distanceKm: 9.994, ascent: 599.49 }), null)
  for (const [input, rounded] of [[9.995, 10], [9.996, 10], [10.08765, 10.09], [0.07836, 0.08]]) {
    const source = { ...base, distanceKm: input, ascent: 599.5 }
    const merged = mergeGarminMetrics(source, {}, {}, verifiedReview(source))
    assert.equal(merged.distanceKm, rounded)
    assert.equal(merged.verified?.distanceKm, rounded)
    assert.equal(merged.verified?.ascent, 600)
    assert.equal(source.distanceKm, input)
  }
  assert.equal(metrics({ distanceKm: undefined, ascent: 600 }), null)
  assert.equal(metrics({ ascent: undefined }), null)
  assert.equal(metrics({ manual: true }), null)
  assert.equal(metrics({ isWebUpload: true }), null)
  assert.equal(metrics({ distanceKm: 100 }), null)
  assert.equal(mergeGarminMetrics(base, {}, fit).verified, null)
  assert.equal(metrics({}, { ...fit, fitStartTime: 0 }), null)
  assert.deepEqual(metrics({ distanceKm: 9.9999, ascent: 600 }), {
    distanceKm: 10, ascent: 600, elapsedSeconds: 7_259, startTimeInSeconds: base.startTimeInSeconds,
  })
  assert.equal(metrics({})?.ascent, 0)
  assert.equal(mergeGarminMetrics(base, { elapsedSeconds: 1800 }, fit).elapsed, '02:00')
})
