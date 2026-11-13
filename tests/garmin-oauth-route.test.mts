import assert from 'node:assert/strict'
import { createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { test } from 'node:test'
import { NextRequest } from 'next/server'
import { GET } from '../app/api/garmin/callback/route'
import { POST } from '../app/api/garmin/start/route'

test('Garmin OAuth binds the browser to the authenticated owner and consumes each attempt once', async t => {
  const env = process.env
  const key = randomBytes(32)
  const origin = 'https://uhl.example'
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
  let verifier = ''
  t.mock.method(globalThis, 'fetch', async (input: URL | string, init: RequestInit) => {
    const { origin, pathname, searchParams } = new URL(input)
    const auth = new Headers(init.headers).get('authorization')
    if (pathname === '/auth/v1/user') {
      assert.equal(auth, 'Bearer uhl-session')
      return Response.json({ id: owner })
    }
    if (pathname === '/rest/v1/garmin_connections') {
      assert.equal(auth, 'Bearer service-key')
      if (init.method === 'POST') {
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
      if (!searchParams.has('state_hash')) return new Response(null, { status: 204 })
      assert.ok(searchParams.get('expires_at')?.startsWith('gt.'))
      if (expired || !attempt || searchParams.get('state_hash') !== `eq.${attempt.state_hash}` ||
          searchParams.get('browser_hash') !== `eq.${attempt.browser_hash}`) return Response.json([])
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
      return Response.json({
        access_token: 'test-access', refresh_token: 'test-refresh', expires_in: 3600,
        refresh_token_expires_in: 36000, token_type: 'bearer',
      })
    }
    assert.equal(origin, 'https://apis.garmin.com')
    assert.equal(auth, 'Bearer test-access')
    if (pathname.endsWith('/id')) return Response.json({ userId: 'garmin-owner' })
    assert.ok(pathname.endsWith('/permissions'))
    return Response.json(allowed ? ['ACTIVITY_EXPORT'] : [])
  })

  const start = (requestOrigin = origin, authorization = 'Bearer uhl-session') => POST(new Request(
    `${origin}/api/garmin/start`, { method: 'POST', headers: { Origin: requestOrigin, Authorization: authorization } },
  ))
  const callback = (query: string, cookie = '') => GET(new NextRequest(`${redirect}?${query}`, {
    headers: { Cookie: cookie },
  }))
  async function begin() {
    const response = await start()
    assert.equal(response.status, 200)
    assert.match(response.headers.get('set-cookie')!, /Secure; HttpOnly; SameSite=lax/i)
    const cookie = response.headers.get('set-cookie')!.split(';')[0]
    const state = new URL(response.headers.get('x-garmin-authorization-url')!).searchParams.get('state')!
    assert.equal(attempt?.state_hash, hash(state))
    assert.equal(attempt?.browser_hash, hash(cookie.split('=')[1]))
    assert.equal(attempt?.user_id, owner)
    return { state, cookie, query: `state=${state}&code=garmin-code` }
  }

  process.env.GARMIN_OAUTH_ENABLED = 'false'
  assert.equal((await callback('')).status, 404)
  assert.equal((await start()).status, 404)
  process.env.GARMIN_OAUTH_ENABLED = 'true'
  assert.equal((await start('https://other.example')).status, 403)
  assert.equal((await start(origin, '')).status, 401)
  const refused = await begin()
  assert.equal((await callback(refused.query)).status, 400)
  assert.equal((await callback(refused.query, `uhl_garmin_attempt=${randomBytes(32).toString('base64url')}`)).status, 400)
  assert.equal((await callback(`${refused.query}&state=${refused.state}`, refused.cookie)).status, 400)
  expired = true
  assert.equal((await callback(refused.query, refused.cookie)).status, 400)
  expired = false
  const cancelled = await callback(`state=${refused.state}&error=access_denied`, refused.cookie)
  assert.equal(cancelled.headers.get('location'), `${origin}/account?garmin=cancelled`)
  assert.equal(exchanges, 0)

  allowed = false
  const ungranted = await begin()
  const permission = await callback(ungranted.query, ungranted.cookie)
  assert.equal(permission.headers.get('location'), `${origin}/account?garmin=permission-required`)
  assert.equal(Boolean(saved), false)

  allowed = true
  const granted = await begin()
  const replies = await Promise.all([callback(granted.query, granted.cookie), callback(granted.query, granted.cookie)])
  assert.deepEqual(replies.map(reply => reply.status).sort(), [303, 400])
  const connected = replies.find(reply => reply.status === 303)!
  assert.equal(connected.headers.get('location'), `${origin}/account?garmin=connected`)
  assert.equal(connected.headers.get('cache-control'), 'no-store')
  assert.equal(connected.headers.get('referrer-policy'), 'no-referrer')
  assert.match(connected.headers.get('set-cookie')!, /Max-Age=0/)
  assert.equal(await connected.text(), '')
  assert.equal(exchanges, 2)
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
})
