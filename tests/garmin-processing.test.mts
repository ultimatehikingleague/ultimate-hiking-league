import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mergeGarminMetrics } from '../app/lib/activity/garmin-metrics'
import { decryptGarminValue, encryptGarminTokens, refreshGarminTokens } from '../app/lib/activity/garmin-connection.server'

test('Garmin merge prioritizes file elapsed time and retains provenance across feeds', () => {
  const result = mergeGarminMetrics({ type: 'HIKING', distanceKm: 9.999, manual: true },
    { elapsedSeconds: 17519, ascent: 600 }, { elapsedSeconds: 90_059 })
  assert.equal(result.elapsed, '25:00')
  assert.equal(result.eligibility, 'regular')
  assert.equal(result.manual, true)
  assert.equal(mergeGarminMetrics({ distanceKm: 9.994, ascent: 599.49 }, {}, {}).eligibility, 'exception')
  assert.equal(mergeGarminMetrics({}, {}, {}).elapsed, null)
})

test('refresh exchanges the old token and protects the rotated pair for its owner', async t => {
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    assert.equal(url, 'https://connectapi.garmin.com/di-oauth2-service/oauth/token')
    assert.deepEqual(Object.fromEntries(init.body as URLSearchParams), {
      grant_type: 'refresh_token', refresh_token: 'previous', client_id: 'client', client_secret: 'secret',
    })
    return Response.json({
      access_token: 'next-access', refresh_token: 'next-refresh', token_type: 'bearer',
      expires_in: 3600, refresh_token_expires_in: 36000,
    })
  })
  const tokens = await refreshGarminTokens({ clientId: 'client', clientSecret: 'secret' }, 'previous')
  const key = Buffer.alloc(32, 1)
  const encrypted = encryptGarminTokens(key, 'owner', tokens)
  assert.equal(JSON.parse(decryptGarminValue(key, 'owner', encrypted)).refreshToken, 'next-refresh')
  assert.throws(() => decryptGarminValue(key, 'other-owner', encrypted))
})

for (const scenario of ['download', 'standard-404', 'stored', 'gone', 'invalid', 'storage-unavailable', 'access-denied', 'network', 'garmin-400', 'garmin-retry', 'garmin-exhausted', 'unknown-400', 'missing-bucket', 'info-existing', 'revoked'] as const) {
  test(`Garmin FIT worker handles ${scenario}`, async t => {
    const { Encoder, Profile, Utils } = await import('@garmin/fitsdk')
    const { createCipheriv } = await import('node:crypto')
    const { GET } = await import('../app/api/garmin/jobs/route')
    const old = process.env
    const key = Buffer.alloc(32, 7)
    process.env = {
      ...old, CRON_SECRET: 'test-secret', GARMIN_OAUTH_ENABLED: 'false', GARMIN_WORKER_ENABLED: 'true', GARMIN_PILOT_USER_ID: '00000000-0000-0000-0000-000000000001', GARMIN_CLIENT_ID: 'client',
      GARMIN_CLIENT_SECRET: 'secret', GARMIN_REDIRECT_URI: 'https://uhl.example/api/garmin/callback',
      GARMIN_TOKEN_KEY: key.toString('base64url'), NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service',
    }
    t.after(() => { process.env = old })
    const encoder = new Encoder()
    const start = (Date.parse('2026-10-10T10:00:00Z') - Utils.FIT_EPOCH_MS) / 1000
    const fileId = { mesgNum: Profile.MesgNum.FILE_ID, type: 'activity', manufacturer: 'garmin', timeCreated: start }
    encoder.writeMesg(fileId)
    const session = { mesgNum: Profile.MesgNum.SESSION, sport: 'hiking', startTime: start,
      timestamp: start + 90_059, totalElapsedTime: 90_059, totalTimerTime: 80_000, totalDistance: 100_000, totalAscent: 900 }
    encoder.writeMesg(session)
    const fit = new Uint8Array(encoder.close())
    const callback = 'https://apis.garmin.com/wellness-api/rest/activityFile?id=1&token=synthetic'
    const iv = Buffer.alloc(12, 1)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    cipher.setAAD(Buffer.from('garmin-file:hash'))
    const ciphertext = Buffer.concat([cipher.update(callback), cipher.final()])
    const encryptedUrl = ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'),
      ciphertext.toString('base64url')].join('.')
    const log = t.mock.method(console, 'warn', () => {})
    const importsFit = ['download', 'standard-404', 'stored'].includes(scenario)
    const rejectsStorage = ['storage-unavailable', 'access-denied', 'network', 'unknown-400', 'missing-bucket', 'info-existing'].includes(scenario)
    let infoRequests = 0
    const downloadFails = ['garmin-400', 'garmin-retry', 'garmin-exhausted'].includes(scenario)
    let claims = 0
    let summaryFinished = false
    let stored = scenario === 'stored'
    let finished = false
    let downloads = 0
    t.mock.method(globalThis, 'fetch', async (input: URL | string, init: RequestInit) => {
      const { pathname } = new URL(input)
      if (pathname.endsWith('/list_garmin_files_for_cleanup')) return Response.json([])
      if (pathname.endsWith('/claim_garmin_push')) {
        assert.equal(JSON.parse(String(init.body)).p_pilot_owner, undefined)
        claims++
        if (claims === 2 && downloadFails) {
          return Response.json([{ id: 2, attempts: 1, owner_id: 'owner', feed: 'activities',
            payload: { activityId: '2', type: 'HIKING', distanceKm: 0.53, ascent: 2 } }])
        }
        if (claims > 1) return Response.json([])
        return Response.json([{ id: 1, attempts: scenario === 'garmin-exhausted' ? 3 : 1,
          owner_id: 'owner', fingerprint: 'hash', feed: 'activityFiles',
          payload: { activityId: '1', type: 'HIKING', privateEvidence: { manual: false }, ...(downloadFails && { manual: false }),
            file: { format: 'FIT', encryptedUrl } } }])
      }
      if (pathname.endsWith('/garmin_connections')) {
        assert.equal(new URL(input).searchParams.get('activity_export_revoked_at'), 'is.null')
        return Response.json(scenario === 'revoked' ? [] : [{ user_id: 'owner' }])
      }
      if (String(input) === callback) {
        assert.equal(init.redirect, 'error')
        downloads++
        if (scenario === 'garmin-400') return new Response(null, { status: 400 })
        if (scenario === 'garmin-retry' || scenario === 'garmin-exhausted') return new Response(null, { status: 503 })
        if (scenario === 'gone') return new Response(null, { status: 410 })
        return new Response(scenario === 'invalid' ? new Uint8Array([0, 1]) : fit)
      }
      if (pathname.endsWith('/finish_garmin_push')) {
        const body = JSON.parse(String(init.body))
        if (body.p_id === 2) {
          assert.equal(body.p_failure, null)
          assert.equal(body.p_metrics.distanceKm, 0.53)
          assert.equal(body.p_metrics.ascent, 2)
          summaryFinished = true
          return Response.json(null)
        }
        assert.equal(body.p_metrics.privateEvidence, undefined)
        assert.equal(body.p_metrics.manual, downloadFails ? false : undefined)
        if (importsFit) {
          assert.ok(stored)
          assert.equal(body.p_metrics.elapsedSeconds, 90_059)
          assert.equal(body.p_metrics.fitVerified, true)
          assert.equal(body.p_metrics.fitElapsedSeconds, 90_059)
          assert.equal(body.p_metrics.fitStartTime, Date.parse('2026-10-10T10:00:00Z') / 1000)
          assert.equal(body.p_metrics.distanceKm, 100)
          assert.equal(body.p_metrics.ascent, 900)
          assert.equal(body.p_failure, null)
        } else {
          assert.equal(body.p_metrics.elapsedSeconds, undefined)
          assert.equal(body.p_metrics.fitVerified, undefined)
          assert.equal(body.p_failure, ({
            gone: 'download-gone', 'garmin-400': 'download-rejected', 'garmin-exhausted': 'download-failed',
          } as Record<string, string>)[scenario] ?? 'invalid-activity-file')
        }
        finished = true
        return Response.json(null)
      }
      assert.ok(pathname.includes('/storage/v1/object/'))
      if (init.method === 'POST') {
        stored = true
        return Response.json({ Key: 'owner/hash.fit' })
      }
      if (stored) return new Response(fit)
      const info = pathname.includes('/object/info/')
      if (info) infoRequests++
      if (scenario === 'network') throw new TypeError(callback)
      if (scenario === 'storage-unavailable') return Response.json({ code: 'InternalError' }, { status: 503 })
      if (info && scenario === 'access-denied') {
        return Response.json({ code: 'AccessDenied', message: callback }, { status: 403 })
      }
      if (info && scenario === 'unknown-400') {
        return Response.json({ statusCode: '404', code: callback, message: 'Object not found' }, { status: 400 })
      }
      if (info && scenario === 'missing-bucket') {
        return Response.json({ code: 'NoSuchBucket' }, { status: 404 })
      }
      if (info && scenario === 'info-existing') return Response.json({ id: 'existing' })
      return Response.json({ statusCode: '404', code: 'NoSuchKey', message: 'Object not found' },
        { status: scenario === 'standard-404' ? 404 : 400 })
    })
    assert.equal((await GET(new Request('http://localhost/api/garmin/jobs'))).status, 401)
    assert.equal((await GET(new Request('http://localhost/api/garmin/jobs', {
      headers: { Authorization: 'Bearer test-secret' },
    }))).status, rejectsStorage ? 503 : 200)
    assert.equal(finished, !rejectsStorage && scenario !== 'revoked' && scenario !== 'garmin-retry')
    assert.equal(summaryFinished, downloadFails)
    assert.equal(downloads, scenario === 'stored' || rejectsStorage || scenario === 'revoked' ? 0 : 1)
    assert.equal(infoRequests, ['stored', 'storage-unavailable', 'network', 'revoked'].includes(scenario) ? 0 : 1)
    if (scenario === 'access-denied') {
      assert.deepEqual(log.mock.calls[0]?.arguments, ['Garmin worker failure',
        { phase: 'storage-info', jobId: 1, attempt: 1, status: 403, code: 'AccessDenied' }])
    }
    assert.doesNotMatch(JSON.stringify(log.mock.calls.map(call => call.arguments)), /synthetic|apis\.garmin\.com/)
  })
}

test('Garmin worker retries private file cleanup with OAuth switched off', async t => {
  const { GET } = await import('../app/api/garmin/jobs/route')
  const original = process.env
  const owner = '00000000-0000-0000-0000-000000000001'
  const file = `${owner}/orphan.fit`
  process.env = {
    ...original, GARMIN_WORKER_ENABLED: 'true', GARMIN_OAUTH_ENABLED: 'false',
    GARMIN_PILOT_USER_ID: owner, CRON_SECRET: 'test-secret',
    GARMIN_TOKEN_KEY: Buffer.alloc(32).toString('base64url'),
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321', SUPABASE_SERVICE_ROLE_KEY: 'service',
  }
  t.after(() => { process.env = original })

  let removed = false
  let attempts = 0
  t.mock.method(globalThis, 'fetch', async (url: string | URL, init: RequestInit) => {
    const path = new URL(url).pathname
    if (path.endsWith('/list_garmin_files_for_cleanup')) return Response.json(removed ? [] : [{ name: file }])
    if (path.endsWith('/claim_garmin_push')) {
      assert.ok(removed)
      return Response.json([])
    }
    assert.equal(path, '/storage/v1/object/garmin-activity-files')
    assert.equal(init.method, 'DELETE')
    assert.deepEqual(JSON.parse(String(init.body)), { prefixes: [file] })
    attempts++
    if (attempts === 1) return Response.json({ message: 'Storage unavailable' }, { status: 503 })
    removed = true
    return Response.json([{ name: file }])
  })

  const request = () => new Request('http://localhost/api/garmin/jobs', {
    headers: { Authorization: 'Bearer test-secret' },
  })
  assert.equal((await GET(request())).status, 503)
  assert.equal((await GET(request())).status, 200)
  assert.equal((await GET(request())).status, 200)
  assert.equal(attempts, 2)
})

test('disabled Garmin worker rejects requests before contacting Supabase', async t => {
  const { GET } = await import('../app/api/garmin/jobs/route')
  const original = process.env
  process.env = { ...original, GARMIN_WORKER_ENABLED: 'false', CRON_SECRET: 'test-secret' }
  t.after(() => { process.env = original })

  const fetchMock = t.mock.method(globalThis, 'fetch', async () => assert.fail('Disabled worker contacted an external service'))
  const request = (token: string) => new Request('http://localhost/api/garmin/jobs', {
    headers: { Authorization: `Bearer ${token}` },
  })

  assert.equal((await GET(request('wrong-secret'))).status, 401)
  assert.equal((await GET(request('test-secret'))).status, 404)
  assert.equal(fetchMock.mock.callCount(), 0)
})
