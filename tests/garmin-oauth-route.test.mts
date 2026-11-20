import assert from 'node:assert/strict'
import { createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { test } from 'node:test'
import { NextRequest } from 'next/server'
import { GET } from '../app/api/garmin/callback/route'
import { POST } from '../app/api/garmin/start/route'
import { POST as finish } from '../app/api/garmin/finish/route'

test('Garmin OAuth stages a callback in a separate browser and requires the initiating proof and authenticated owner', async t => {
  const env = process.env
  const key = randomBytes(32)
  const origin = 'https://www.ultimatehikingleague.com'
  const europeanOrigin = 'https://www.europeanhikingleague.com'
  const redirect = `${origin}/api/garmin/callback`
  const owner = 'c6fdbe30-198a-4f4f-8287-ea396087644e'
  const hash = (value: string) => createHash('sha256').update(value).digest('hex')
  process.env = {
    ...env,
    GARMIN_OAUTH_ENABLED: 'true',
    GARMIN_CLIENT_ID: 'client',
    GARMIN_CLIENT_SECRET: 'secret',
    GARMIN_REDIRECT_URI: redirect,
    GARMIN_TOKEN_KEY: key.toString('base64url'),
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  }
  t.after(() => { process.env = env })

  let attempt: Record<string, string> | undefined
  let saved: Record<string, string> | undefined
  let exchanges = 0
  let allowed = true
  let expired = false
  let databaseUnavailable = false
  let providerUnavailable = false
  let identityResponse = () => Response.json({ userId: 'garmin-owner' })
  let permissionsResponse = () => Response.json({ permissions: allowed ? ['ACTIVITY_EXPORT'] : [] })
  let saveUnavailable = false
  let verifier = ''
  const diagnostics = t.mock.method(console, 'error', () => {})
  const shapeWarnings = t.mock.method(console, 'warn', () => {})
  t.mock.method(globalThis, 'fetch', async (input: URL | string, init: RequestInit) => {
    const { origin, pathname, searchParams } = new URL(input)
    const auth = new Headers(init.headers).get('authorization')
    if (pathname === '/auth/v1/user') {
      assert.ok(auth === 'Bearer uhl-session' || auth === 'Bearer other-session')
      return Response.json({ id: auth === 'Bearer uhl-session' ? owner : '00000000-0000-0000-0000-000000000001' })
    }
    if (pathname === '/rest/v1/garmin_connections') {
      assert.equal(auth, 'Bearer service-key')
      if (init.method === 'POST') {
        if (saveUnavailable) return Response.json({ message: 'private-database-detail' }, { status: 500 })
        saved = JSON.parse(String(init.body))
        return new Response(null, { status: 201 })
      }
      return Response.json(saved ? [{ user_id: owner }] : [])
    }
    if (pathname === '/rest/v1/garmin_oauth_attempts') {
      assert.equal(auth, 'Bearer service-key')
      if (init.method === 'POST') {
        attempt = JSON.parse(String(init.body))
        verifier = attempt!.verifier
        return new Response(null, { status: 201 })
      }
      if (init.method === 'DELETE' && !searchParams.has('browser_hash')) return new Response(null, { status: 204 })
      if (databaseUnavailable) return new Response(null, { status: 503 })
      assert.ok(searchParams.get('expires_at')?.startsWith('gt.'))
      if (expired || !attempt) return Response.json([])
      if (init.method === 'PATCH') {
        assert.equal(searchParams.get('callback_result'), 'is.null')
        if (attempt.callback_result || searchParams.get('state_hash') !== `eq.${attempt.state_hash}`) return Response.json([])
        attempt.callback_result = JSON.parse(String(init.body)).callback_result
        assert.ok(attempt.callback_result.startsWith('v1.'))
        assert.ok(!attempt.callback_result.includes('garmin-code'))
        return Response.json([{ state_hash: attempt.state_hash }])
      }
      assert.equal(searchParams.get('callback_result'), 'not.is.null')
      if (searchParams.get('user_id') !== `eq.${attempt.user_id}` ||
          !attempt.callback_result || searchParams.get('browser_hash') !== `eq.${attempt.browser_hash}`) return Response.json([])
      const consumed = attempt
      attempt = undefined
      return Response.json([consumed])
    }
    if (pathname === '/di-oauth2-service/oauth/token') {
      assert.equal(origin, 'https://connectapi.garmin.com')
      assert.equal(init.redirect, 'error')
      const params = new URLSearchParams(String(init.body))
      assert.deepEqual(Object.fromEntries(params), {
        grant_type: 'authorization_code', client_id: 'client', client_secret: 'secret',
        redirect_uri: redirect, code: 'garmin-code', code_verifier: verifier,
      })
      exchanges++
      if (providerUnavailable) return Response.json({
        error: 'invalid_grant', error_description: 'private-provider-detail',
      }, { status: 400 })
      return Response.json({
        access_token: 'test-access', refresh_token: 'test-refresh', expires_in: 3600,
        refresh_token_expires_in: 36000, token_type: 'bearer',
      })
    }
    assert.equal(origin, 'https://apis.garmin.com')
    assert.equal(auth, 'Bearer test-access')
    assert.equal(init.method ?? 'GET', 'GET')
    assert.equal(init.redirect, 'error')
    assert.equal(searchParams.size, 0)
    if (pathname === '/partner-gateway/rest/user/id') {
      return identityResponse()
    }
    assert.equal(pathname, '/partner-gateway/rest/user/permissions')
    return permissionsResponse()
  })

  const start = (requestOrigin = origin, authorization = 'Bearer uhl-session') => POST(new Request(
    `${origin}/api/garmin/start`, { method: 'POST', headers: { Origin: requestOrigin, Authorization: authorization } },
  ))
  const mobileSafari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
  const mobileChrome = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/130.0.0.0 Mobile/15E148 Safari/604.1'
  const callback = (query: string, userAgent = mobileSafari) => GET(new NextRequest(`${redirect}?${query}`, {
    headers: { 'User-Agent': userAgent, 'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Site': 'cross-site' },
  }))
  const complete = (proof: string, authorization = 'Bearer uhl-session', requestOrigin = origin) => finish(new Request(
    `${origin}/api/garmin/finish`, {
      method: 'POST',
      headers: { Origin: requestOrigin, Authorization: authorization, 'X-Garmin-Attempt-Proof': proof },
    },
  ))
  async function expectReturn(response: Response, status: string, returnOrigin = '') {
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('location'), `${returnOrigin}/garmin/return?status=${status}`)
    assert.equal(response.headers.get('content-disposition'), null)
    assert.equal(response.headers.get('set-cookie'), null)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
    assert.equal(await response.text(), '')
  }
  async function completeStatus(proof: string) {
    const response = await complete(proof)
    assert.equal(response.status, 200)
    return (await response.json()).status
  }
  async function begin(requestOrigin = origin) {
    const response = await start(requestOrigin)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('set-cookie'), null)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    const proof = response.headers.get('x-garmin-attempt-proof')!
    const params = new URL(response.headers.get('x-garmin-authorization-url')!).searchParams
    const state = params.get('state')!
    assert.equal(params.get('redirect_uri'), redirect)
    assert.equal(params.get('code_challenge_method'), 'S256')
    assert.equal(params.get('code_challenge'), createHash('sha256').update(verifier).digest('base64url'))
    assert.notEqual(proof, state)
    assert.equal(attempt?.state_hash, hash(state))
    assert.equal(attempt?.browser_hash, hash(proof))
    assert.equal(attempt?.user_id, owner)
    return { state, proof, query: `state=${state}&code=garmin-code` }
  }

  process.env.GARMIN_OAUTH_ENABLED = 'false'
  await expectReturn(await callback(''), 'unavailable')
  assert.equal((await start()).status, 404)
  process.env.GARMIN_OAUTH_ENABLED = 'true'
  assert.equal((await start('https://other.example')).status, 403)
  assert.equal((await start(origin, '')).status, 401)
  assert.equal((await start(europeanOrigin, '')).status, 401)
  const refused = await begin()
  for (const userAgent of [mobileSafari, mobileChrome]) {
    await expectReturn(await callback(`${refused.query}&state=${refused.state}`, userAgent), 'retry')
    await expectReturn(await callback(`${refused.query}&error=access_denied`, userAgent), 'retry')
    expired = true
    await expectReturn(await callback(refused.query, userAgent), 'retry')
    assert.equal(await completeStatus(refused.proof), 'waiting')
    expired = false
  }
  databaseUnavailable = true
  await expectReturn(await callback(refused.query), 'unavailable')
  assert.equal((await complete(refused.proof)).status, 503)
  databaseUnavailable = false
  await expectReturn(await callback(`state=${refused.state}&error=access_denied`), 'received')
  assert.equal(await completeStatus(refused.proof), 'cancelled')
  assert.equal(exchanges, 0)

  const providerError = await begin()
  await expectReturn(await callback(`state=${providerError.state}&error=server_error&error_description=provider-details`), 'received')
  assert.equal(await completeStatus(providerError.proof), 'unavailable')
  assert.equal(exchanges, 0)

  providerUnavailable = true
  const rejected = await begin()
  await expectReturn(await callback(rejected.query), 'received')
  assert.equal(await completeStatus(rejected.proof), 'unavailable')
  assert.equal(Boolean(saved), false)
  providerUnavailable = false

  for (const stage of ['http', 'fetch-and-json', 'json-and-fetch', 'shape', 'save-connection', 'decrypt-callback']) {
    identityResponse = () => {
      if (stage === 'http') return new Response('private-body', { status: 502 })
      if (stage === 'fetch-and-json') throw new TypeError('private-network-error')
      if (stage === 'json-and-fetch') return new Response('private-invalid-json')
      if (stage === 'shape') return Response.json({ userId: ['private-id'], privateField: 'private-value' })
      return Response.json({ userId: 'garmin-owner' })
    }
    permissionsResponse = () => {
      if (stage === 'http') return new Response('private-body', { status: 403 })
      if (stage === 'fetch-and-json') return new Response('private-invalid-json')
      if (stage === 'json-and-fetch') throw new DOMException('private-timeout', 'TimeoutError')
      if (stage === 'shape') return Response.json(['ACTIVITY_EXPORT'])
      return Response.json({ permissions: allowed ? ['ACTIVITY_EXPORT'] : [] })
    }
    saveUnavailable = stage === 'save-connection'
    const failing = await begin()
    await expectReturn(await callback(failing.query), 'received')
    if (stage === 'decrypt-callback') attempt!.callback_result = 'invalid-envelope'
    assert.equal(await completeStatus(failing.proof), 'unavailable')
    assert.equal(await completeStatus(failing.proof), 'waiting')
    assert.equal(Boolean(saved), false)
  }
  assert.deepEqual(diagnostics.mock.calls.map(call => call.arguments), [
    ['Garmin OAuth callback failed', { stage: 'stage-callback' }],
    ['Garmin OAuth finish failed', { stage: 'claim' }],
    ['Garmin OAuth finish failed', { stage: 'provider-callback' }],
    ['Garmin OAuth finish failed', { stage: 'token', endpoint: 'token', httpStatus: 400, oauthError: 'invalid_grant' }],
    ['Garmin OAuth finish failed', { stage: 'identity-or-permissions', endpoint: '/user/id', kind: 'http', httpStatus: 502 }],
    ['Garmin OAuth finish failed', { stage: 'identity-or-permissions', endpoint: '/user/permissions', kind: 'http', httpStatus: 403 }],
    ['Garmin OAuth finish failed', { stage: 'identity-or-permissions', endpoint: '/user/id', kind: 'fetch', errorClass: 'TypeError' }],
    ['Garmin OAuth finish failed', { stage: 'identity-or-permissions', endpoint: '/user/permissions', kind: 'json', errorClass: 'SyntaxError' }],
    ['Garmin OAuth finish failed', { stage: 'identity-or-permissions', endpoint: '/user/id', kind: 'json', errorClass: 'SyntaxError' }],
    ['Garmin OAuth finish failed', { stage: 'identity-or-permissions', endpoint: '/user/permissions', kind: 'fetch', errorClass: 'TimeoutError' }],
    ['Garmin OAuth finish failed', { stage: 'identity-or-permissions', endpoint: '/user/id', kind: 'shape', fields: { body: 'object', userId: 'array' } }],
    ['Garmin OAuth finish failed', { stage: 'identity-or-permissions', endpoint: '/user/permissions', kind: 'shape', fields: { body: 'array', permissions: 'missing' } }],
    ['Garmin OAuth finish failed', { stage: 'save-connection' }],
    ['Garmin OAuth finish failed', { stage: 'decrypt-callback' }],
  ])

  allowed = false
  const ungranted = await begin()
  await expectReturn(await callback(ungranted.query), 'received')
  assert.equal(await completeStatus(ungranted.proof), 'permission-required')
  assert.equal(Boolean(saved), false)

  permissionsResponse = () => Response.json({ permissions: [['ACTIVITY_EXPORT'], { privateField: 'private-value' }] })
  const nested = await begin()
  await expectReturn(await callback(nested.query), 'received')
  assert.equal(await completeStatus(nested.proof), 'permission-required')
  assert.equal(Boolean(saved), false)
  assert.deepEqual(shapeWarnings.mock.calls.map(call => call.arguments), [
    ['Garmin user endpoint response shape', {
      endpoint: '/user/permissions', kind: 'shape', fields: { permissions: 'array', itemTypes: ['array', 'object'] },
    }],
  ])

  allowed = true
  permissionsResponse = () => Response.json({ permissions: ['ACTIVITY_EXPORT'] })
  const granted = await begin()
  assert.equal(await completeStatus(granted.proof), 'waiting')
  await expectReturn(await callback(granted.query, mobileChrome), 'received')
  await expectReturn(await callback(granted.query, mobileSafari), 'retry')
  assert.equal((await complete(granted.proof, '')).status, 401)
  assert.equal((await (await complete(granted.proof, 'Bearer other-session')).json()).status, 'waiting')
  assert.equal((await complete(granted.proof, 'Bearer uhl-session', 'https://other.example')).status, 403)
  assert.equal(await completeStatus(granted.state), 'waiting')
  assert.equal(exchanges, 8)
  const statuses = await Promise.all([completeStatus(granted.proof), completeStatus(granted.proof)])
  assert.deepEqual(statuses.sort(), ['connected', 'waiting'])
  assert.equal(exchanges, 9)
  assert.equal(saved?.['user_id'], owner)
  assert.equal(saved?.['garmin_user_id'], 'garmin-owner')
  const [version, iv, tag, ciphertext] = saved!['encrypted_tokens'].split('.')
  assert.equal(version, 'v1')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'))
  decipher.setAAD(Buffer.from(owner))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  const stored = JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString())
  assert.equal(stored.accessToken, 'test-access')
  assert.equal(stored.refreshToken, 'test-refresh')
  assert.equal((await start()).status, 409)
  assert.equal((await start(europeanOrigin)).status, 409)

  saved = undefined
  const european = await begin(europeanOrigin)
  assert.match(european.state, /^ehl_[A-Za-z0-9_-]{43}$/)
  await expectReturn(await callback(granted.query.replace(granted.state, 'ehl_' + granted.state)), 'retry')
  await expectReturn(await callback(european.query, mobileSafari), 'received', europeanOrigin)
  const europeanResult = await complete(european.proof, 'Bearer uhl-session', europeanOrigin)
  assert.equal((await europeanResult.json()).status, 'connected')
  assert.equal((await start(europeanOrigin)).status, 409)
})
