import assert from 'node:assert/strict'
import test from 'node:test'
import { garminDetailsPath, makeDetailsReceiver } from '../services/garmin-details/receiver'
import { detailsRelayItem, detailsRelaySignature } from '../app/lib/activity/garmin-details-relay'
import { normalizeGarminPush } from '../app/lib/activity/garmin-push.server'

const relayKey = Buffer.alloc(32, 23)
const start = 1_700_000_000
const summary = {
  activityId: 123, activityType: 'HIKING', startTimeInSeconds: start,
  deviceName: 'Fixture Garmin', distanceInMeters: 11500, totalElevationGainInMeters: 71,
  manual: false, isWebUpload: false,
}
const detail = { userId: 'fixture-user', summaryId: 'fixture-detail', activityId: 123, summary,
  samples: [
    { startTimeInSeconds: start, clockDurationInSeconds: 0, timerDurationInSeconds: 0, latitudeInDegree: 50, longitudeInDegree: 11 },
    { startTimeInSeconds: start + 7359, clockDurationInSeconds: 7359, timerDurationInSeconds: 5000,
      latitudeInDegree: 50.001, longitudeInDegree: 11.001 },
  ],
}
const endpoint = 'https://receiver.example' + garminDetailsPath
const makeRequest = (body: string, extra?: Record<string,string>) => new Request(endpoint, {
  method: 'POST', headers: { 'content-type': 'application/json', ...extra }, body,
})

test('large Garmin feed reaches the existing authenticated queue and retries with the same evidence', async t => {
  const env = {
    GARMIN_DETAILS_RELAY_KEY: relayKey.toString('base64url'), GARMIN_PUSH_ENABLED: 'true',
    GARMIN_TOKEN_KEY: Buffer.alloc(32, 42).toString('base64url'), NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
  }
  for (const [name, value] of Object.entries(env)) {
    const previous = process.env[name]
    process.env[name] = value
    t.after(() => previous === undefined ? delete process.env[name] : (process.env[name] = previous))
  }

  const { POST } = await import('../app/api/garmin/details-relay/route')
  const stable = new Set<string>()
  let calls = 0
  let fail = false
  let largeBatch = true
  t.mock.method(globalThis, 'fetch', async (url: string | URL, request: RequestInit) => {
    calls++
    assert.equal(new URL(url).pathname, '/rest/v1/rpc/enqueue_garmin_push')
    const { p_feed, p_items } = JSON.parse(String(request.body))
    assert.equal(p_feed, 'activityDetails')
    const ordinaryItem = detailsRelayItem(normalizeGarminPush('activityDetails', { activityDetails: [detail] })[0])
    assert.deepEqual(p_items[0], ordinaryItem)
    assert.equal(p_items.length, largeBatch ? 23 : 1)
    assert.equal(p_items[0].payload.privateEvidence.elapsedSeconds, 7359)
    assert.equal(p_items[0].payload.elapsed, '02:02')
    for (const item of p_items) assert.equal('samples' in item.payload, false)
    if (largeBatch) {
      assert.equal(p_items[1].payload.elapsed, '02:02')
      assert.equal(p_items[1].payload.privateEvidence.sampleCheck, 'samples-consistent')
    }
    stable.add(p_items[0].fingerprint)
    return fail ? Response.json({ message: 'fixture unavailable' }, { status: 503 }) : Response.json(null)
  })
  const receive = makeDetailsReceiver({ ranges: '192.0.2.0/24', clientId: 'fixture', relayOrigin: 'https://uhl.example',
    relayKey, send: async (url, request) => POST(new Request(url, request)) })
  const plain = JSON.stringify({ activityDetails: [detail] })
  const samples = Array.from({ length: 7360 }, (_, second) => ({
    startTimeInSeconds: start + second, clockDurationInSeconds: second,
    timerDurationInSeconds: Math.min(second, 5000), movingDurationInSeconds: Math.min(second, 4800),
    latitudeInDegree: 50 + second * 0.000005, longitudeInDegree: 11 + second * 0.000005,
    heartRate: 130, elevationInMeters: 202.5,
  }))
  const batch = [detail, ...Array.from({ length: 22 }, (_, index) => {
    const activityId = 124 + index
    return { ...detail, activityId, summaryId: 'fixture-' + activityId, summary: { ...summary, activityId }, samples }
  })]
  const largeBody = JSON.stringify({ activityDetails: batch })
  assert.ok(Buffer.byteLength(largeBody) > 20 * 1024 * 1024)
  assert.equal((await receive(makeRequest(plain, {'x-forwarded-for':'192.0.2.1'}), '203.0.113.1')).status, 403)
  assert.equal((await receive(makeRequest(plain, {'garmin-client-id':'different'}), '192.0.2.1')).status, 403)
  assert.equal(calls, 0)
  assert.equal((await receive(makeRequest(largeBody), '::ffff:192.0.2.1')).status, 200)
  largeBatch = false
  fail = true
  assert.equal((await receive(makeRequest(plain), '192.0.2.1')).status, 503)
  fail = false
  assert.equal((await receive(makeRequest(plain), '192.0.2.1')).status, 200)
  assert.equal(calls, 3)
  assert.equal(stable.size, 1)

  const now = String(Math.floor(Date.now() / 1000))
  const old = String(Number(now) - 125)
  const signed = (timestamp: string, text: string, original = text) => new Request('https://uhl.example/api/garmin/details-relay', {
    method: 'POST', headers: { 'content-type': 'application/json',
      'x-garmin-relay-time': timestamp, 'x-garmin-relay-signature': detailsRelaySignature(relayKey, timestamp, original) }, body: text,
  })
  assert.equal((await POST(signed(old, '[]'))).status, 403)
  assert.equal((await POST(signed(now, '[1]', '[]'))).status, 403)
  assert.equal(calls, 3)
})

test('configured size is enforced during reading, and missing elapsed stays missing', async () => {
  const receive = makeDetailsReceiver({ ranges: '192.0.2.1/32', clientId: 'fixture', relayOrigin: 'https://uhl.example',
    relayKey, bodyMiB: 1, send: async (_url, request) => {
      const [item] = JSON.parse(String(request?.body))
      assert.equal(item.payload.elapsed, null)
      assert.equal(item.payload.privateEvidence.elapsedSeconds, null)
      return new Response(null, { status: 200 })
    } })
  assert.equal((await receive(makeRequest(' '.repeat(1024 * 1024 + 1)), '192.0.2.1')).status, 413)
  const withoutClock = { ...detail, samples: [{ timerDurationInSeconds: 5000 }] }
  assert.equal((await receive(makeRequest(JSON.stringify({ activityDetails: [withoutClock] })), '192.0.2.1')).status, 200)
})

