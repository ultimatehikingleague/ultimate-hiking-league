import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeGarminPush } from '../app/lib/activity/garmin-push.server'

const summary = {
  userId: 'synthetic-user',
  summaryId: 'synthetic-summary',
  activityId: 1234,
  activityType: 'HIKING',
  startTimeInSeconds: 1_700_000_000,
  distanceInMeters: 9999,
  durationInSeconds: 17_000,
}

test('Garmin summaries use unrounded rule thresholds and leave total elapsed time open', () => {
  const [missing, exception, elevation, distance] = normalizeGarminPush('activities', { activities: [
    summary, { ...summary, totalElevationGainInMeters: 599 }, { ...summary, totalElevationGainInMeters: 600 },
    { ...summary, distanceInMeters: 10000, activityType: 'RUNNING', manual: true },
  ] })
  assert.deepEqual([missing.eligibility, exception.eligibility, elevation.eligibility, distance.eligibility],
    ['unknown', 'exception', 'regular', 'regular'])
  assert.equal(missing.activityId, '1234')
  assert.equal(missing.elapsed, null)
  assert.equal(distance.supportedType, false)
  assert.equal(distance.manual, true)
})

test('Garmin Details use clock time including pauses and omit raw samples', () => {
  for (const [seconds, time] of [[17475, '04:51'], [17519, '04:51'], [17999, '04:59'], [90_059, '25:00']] as const) {
    const [item] = normalizeGarminPush('activityDetails', { activityDetails: [{
      userId: summary.userId, summaryId: 'detail', activityId: '1234', summary,
      samples: [{ clockDurationInSeconds: seconds, timerDurationInSeconds: 17000, heartRate: 132 }],
    }] })
    assert.equal(item.elapsed, time)
    assert.equal('samples' in item, false)
  }
})

test('Garmin Details without a clock value do not use timer or moving time', () => {
  const [item] = normalizeGarminPush('activityDetails', { activityDetails: [{
    userId: summary.userId, summaryId: 'detail', activityId: summary.activityId, summary,
    samples: [{ timerDurationInSeconds: 7200, movingDurationInSeconds: 7000 }],
  }] })
  assert.equal(item.elapsed, null)
  assert.equal(item.privateEvidence.elapsedSeconds, null)
})

test('Garmin file notifications accept only the documented download URL shape', () => {
  const file = { ...summary, fileType: 'FIT' }
  const normalize = (callbackURL: string) =>
    normalizeGarminPush('activityFiles', { activityFiles: [{ ...file, callbackURL }] })
  assert.equal(normalize('https://apis.garmin.com/wellness-api/rest/activityFile?id=1&token=test')[0].file?.format, 'FIT')
  for (const url of [
    'https://apis.garmin.com.example.org/wellness-api/rest/activityFile?id=1&token=test',
    'https://apis.garmin.com/wellness-api/rest/activities?id=1&token=test',
    'https://apis.garmin.com/wellness-api/rest/activityFile?id=1&id=2&token=test',
  ]) assert.throws(() => normalize(url), /Invalid Garmin activity file metadata/)
})

test('Garmin receiver checks sender and confirms only persisted requests', async t => {
  const { POST } = await import('../app/api/garmin/push/[feed]/route')
  const env = process.env
  process.env = {
    ...env, GARMIN_PILOT_USER_ID: '00000000-0000-0000-0000-000000000001', VERCEL: '1', GARMIN_PUSH_ENABLED: 'true', GARMIN_OAUTH_ENABLED: 'true',
    GARMIN_PUSH_IP_RANGES: '192.0.2.0/24', GARMIN_CLIENT_ID: 'synthetic-client',
    GARMIN_CLIENT_SECRET: 'synthetic-secret', GARMIN_TOKEN_KEY: Buffer.alloc(32, 1).toString('base64url'),
    GARMIN_REDIRECT_URI: 'https://uhl.example/api/garmin/callback',
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
  }
  t.after(() => { process.env = env })
  let fail = true
  const calls: string[] = []
  let expectedFeed = 'activityFiles'
  t.mock.method(globalThis, 'fetch', async (url: string | URL, init: RequestInit) => {
    assert.equal(new URL(url).pathname, '/rest/v1/rpc/enqueue_garmin_push')
    assert.equal(new Headers(init.headers).get('authorization'), 'Bearer service')
    const body = JSON.parse(String(init.body))
    assert.equal(body.p_feed, expectedFeed)
    assert.equal(body.p_pilot_owner, undefined)
    assert.equal(body.p_items[0].garmin_user_id, 'synthetic-user')
    assert.equal('userId' in body.p_items[0].payload, false)
    assert.ok(!String(init.body).includes('sensitive-download-token'))
    if (expectedFeed === 'activityDetails') {
      const { payload } = body.p_items[0]
      assert.equal(payload.privateEvidence.elapsedSeconds, 17_519)
      assert.equal(payload.elapsed, '04:51')
      assert.equal('samples' in payload, false)
    }
    calls.push(body.p_items[0].fingerprint)
    return fail ? Response.json({ message: 'storage unavailable' }, { status: 500 }) : Response.json(null)
  })
  const callbackURL = 'https://apis.garmin.com/wellness-api/rest/activityFile?id=1&token=sensitive-download-token'
  const invoke = (ip: string) => POST(new Request('https://uhl.example/api/garmin/push/activityFiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-vercel-forwarded-for': ip, 'garmin-client-id': 'synthetic-client' },
    body: JSON.stringify({ activityFiles: [{ ...summary, fileType: 'FIT', callbackURL }] }),
  }), { params: Promise.resolve({ feed: 'activityFiles' }) })
  assert.equal((await invoke('203.0.113.5')).status, 403)
  assert.equal(calls.length, 0)
  assert.equal((await invoke('192.0.2.5')).status, 503)
  fail = false
  assert.equal((await invoke('192.0.2.5')).status, 200)
  assert.equal((await invoke('192.0.2.5')).status, 200)
  assert.equal(new Set(calls).size, 1)

  expectedFeed = 'activityDetails'
  calls.length = 0
  const detail = { userId: summary.userId, summaryId: 'detail', activityId: summary.activityId, summary,
    samples: [{ clockDurationInSeconds: 17_519, timerDurationInSeconds: 17_000, padding: '' }],
  }
  const emptyBody = JSON.stringify({ activityDetails: [detail] })
  const sendDetail = (totalBytes: number, sendLength = false) => {
    const body = emptyBody.replace('"padding":""', '"padding":"' + 'x'.repeat(totalBytes - Buffer.byteLength(emptyBody)) + '"')
    const headers = new Headers({ 'Content-Type': 'application/json', 'x-vercel-forwarded-for': '192.0.2.5' })
    if (sendLength) headers.set('Content-Length', String(totalBytes))
    return POST(new Request('https://uhl.example/api/garmin/push/activityDetails', { method: 'POST', body, headers }),
      { params: Promise.resolve({ feed: 'activityDetails' }) })
  }
  assert.equal((await sendDetail(4_400_000)).status, 200)
  assert.equal((await sendDetail(4_400_000, true)).status, 200)
  assert.equal((await sendDetail(4_400_001)).status, 413)
  assert.equal((await sendDetail(4_400_001, true)).status, 413)
  assert.equal(calls.length, 2)
  assert.equal(new Set(calls).size, 1)
})
