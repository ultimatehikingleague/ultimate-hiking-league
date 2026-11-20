import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DELETE } from '../app/api/garmin/connection/route'
import { decryptGarminValue, encryptGarminTokens } from '../app/lib/activity/garmin-connection.server'

for (const mode of ['rotation', 'invalid_grant', 'provider-failure', 'storage-retry']) {
test(`Garmin disconnect handles ${mode}`, async t => {
  const original = process.env
  const owner = '00000000-0000-0000-0000-000000000001'
  const key = Buffer.alloc(32, 3)
  process.env = {
    ...original, GARMIN_PILOT_USER_ID: owner, GARMIN_OAUTH_ENABLED: 'true', GARMIN_CLIENT_ID: 'client', GARMIN_CLIENT_SECRET: 'secret',
    GARMIN_REDIRECT_URI: 'https://uhl.example/api/garmin/callback', GARMIN_TOKEN_KEY: key.toString('base64url'),
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
  }
  t.after(() => { process.env = original })
  const calls: string[] = []
  let workerActive = true
  let filePresent = true
  let storageFails = mode === 'storage-retry'
  let deregisteredAt: string | null = null
  let lease: string | null = null
  const encrypted = encryptGarminTokens(key, owner, {
    accessToken: 'expired', refreshToken: 'old-refresh',
    accessExpiresAt: Date.now() - 1000, refreshExpiresAt: Date.now() + 100_000,
  })
  t.mock.method(globalThis, 'fetch', async (input: string | URL, init: RequestInit) => {
    const url = new URL(input)
    const headers = new Headers(init.headers)
    if (url.pathname === '/auth/v1/user') return Response.json({ id: owner })
    if (url.pathname.endsWith('/garmin_connections')) {
      assert.equal(url.searchParams.get('user_id'), `eq.${owner}`)
      const body = init.body ? JSON.parse(String(init.body)) : {}
      if (init.method === 'DELETE') {
        assert.equal(url.searchParams.get('disconnect_lease_until'), `eq.${lease}`)
        calls.push('delete-connection')
        return new Response(null, { status: 204 })
      }
      if (body.disconnect_lease_until === null) {
        calls.push('release-lease')
        lease = null
        return new Response(null, { status: 204 })
      }
      if (body.activity_export_revoked_at) {
        deregisteredAt = body.deregistered_at
        calls.push('block')
        return Response.json([{ user_id: owner }])
      }
      if (body.encrypted_tokens) {
        assert.equal(url.searchParams.get('disconnect_lease_until'), `eq.${lease}`)
        assert.equal(JSON.parse(decryptGarminValue(key, owner, body.encrypted_tokens)).refreshToken, 'new-refresh')
        calls.push('save-token')
        return Response.json([{ user_id: owner }])
      }
      lease = body.disconnect_lease_until
      assert.ok(lease)
      calls.push('lease')
      return Response.json([{ encrypted_tokens: encrypted, deregistered_at: deregisteredAt }])
    }
    if (url.pathname.endsWith('/garmin_push_inbox')) {
      assert.equal(url.searchParams.get('owner_id'), `eq.${owner}`)
      return Response.json(workerActive ? [{ id: 1 }] : [])
    }
    if (url.hostname === 'connectapi.garmin.com') {
      assert.equal((init.body as URLSearchParams).get('refresh_token'), 'old-refresh')
      calls.push('refresh')
      if (mode === 'invalid_grant') return Response.json({ error: 'invalid_grant' }, { status: 400 })
      if (mode === 'provider-failure') return new Response(null, { status: 503 })
      return Response.json({
        access_token: 'new-access', refresh_token: 'new-refresh', token_type: 'bearer',
        expires_in: 3600, refresh_token_expires_in: 36000,
      })
    }
    if (url.hostname === 'apis.garmin.com') {
      assert.equal(headers.get('authorization'), 'Bearer new-access')
      assert.equal(init.method, 'DELETE')
      calls.push('deregister')
      return new Response(null, { status: 204 })
    }
    if (url.pathname.includes('/object/list/')) {
      assert.equal(JSON.parse(String(init.body)).prefix, owner)
      return Response.json(filePresent ? [{ name: 'file.fit' }] : [])
    }
    assert.equal(init.method, 'DELETE')
    assert.deepEqual(JSON.parse(String(init.body)).prefixes, [`${owner}/file.fit`])
    if (storageFails) {
      storageFails = false
      return Response.json({ message: 'Storage unavailable' }, { status: 503 })
    }
    filePresent = false
    calls.push('delete-file')
    return Response.json([])
  })
  const request = () => new Request('https://uhl.example/api/garmin/connection', {
    method: 'DELETE', headers: { Origin: 'https://uhl.example', Authorization: 'Bearer owner-token' },
  })
  assert.equal((await DELETE(request())).status, 409)
  assert.deepEqual(calls, ['lease', 'release-lease'])
  calls.length = 0
  workerActive = false
  if (mode === 'provider-failure') {
    assert.equal((await DELETE(request())).status, 503)
    assert.deepEqual(calls, ['lease', 'refresh', 'release-lease'])
    return
  }
  if (mode === 'storage-retry') {
    assert.equal((await DELETE(request())).status, 503)
    assert.deepEqual(calls, ['lease', 'refresh', 'save-token', 'deregister', 'block', 'release-lease'])
    calls.length = 0
  }
  assert.equal((await DELETE(request())).status, 204)
  const providerCalls = mode === 'storage-retry' ? []
    : mode === 'invalid_grant' ? ['refresh', 'block']
    : ['refresh', 'save-token', 'deregister', 'block']
  assert.deepEqual(calls, ['lease', ...providerCalls, 'delete-file', 'delete-connection', 'release-lease'])
})
}
