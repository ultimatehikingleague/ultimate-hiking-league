import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeGarminCommonPush } from '../app/lib/activity/garmin-permissions.server'
import { POST } from '../app/api/garmin/push/[feed]/route'

const changeTimeInSeconds = Math.floor(Date.now() / 1000) - 10
const permission = { userId: 'synthetic-user', summaryId: 'event', permissions: [], changeTimeInSeconds }

test('COMMON accepts only complete batches and retains only the fields used for revocation', () => {
  assert.deepEqual(normalizeGarminCommonPush('deregistrations', {
    deregistrations: [{ userId: 'synthetic-user' }],
  }), [{ user_id: 'synthetic-user' }])

  for (const invalid of [
    { ...permission, userId: '' }, { ...permission, summaryId: '' }, { ...permission, permissions: undefined },
    { ...permission, permissions: ['activity_export'] }, { ...permission, permissions: [null] },
    { ...permission, changeTimeInSeconds: changeTimeInSeconds * 1000 },
  ]) assert.throws(() => normalizeGarminCommonPush('userPermissionsChange', {
    userPermissionsChange: [permission, invalid],
  }))
  assert.throws(() => normalizeGarminCommonPush('deregistrations', { userPermissionsChange: [] }))
  assert.deepEqual(normalizeGarminCommonPush('userPermissionsChange', {
    userPermissionsChange: [permission, { ...permission, permissions: ['ACTIVITY_EXPORT', 'HEALTH_EXPORT'] }],
  }), [false, true].map(has_activity_export => ({
    user_id: permission.userId,
    change_time_seconds: changeTimeInSeconds,
    has_activity_export,
  })))
})

test('COMMON checks the sender and returns 200 only after the RPC succeeds', async t => {
  const env = process.env
  const pilot = '00000000-0000-0000-0000-000000000001'
  process.env = {
    ...env, GARMIN_PILOT_USER_ID: pilot, VERCEL: '1', GARMIN_PUSH_ENABLED: 'true', GARMIN_OAUTH_ENABLED: 'true',
    GARMIN_PUSH_IP_RANGES: '192.0.2.0/24', GARMIN_CLIENT_ID: 'synthetic-client',
    GARMIN_CLIENT_SECRET: 'synthetic-secret', GARMIN_TOKEN_KEY: Buffer.alloc(32, 1).toString('base64url'),
    GARMIN_REDIRECT_URI: 'https://uhl.example/api/garmin/callback',
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
  }
  t.after(() => { process.env = env })
  let fail = true
  const calls: unknown[] = []
  t.mock.method(globalThis, 'fetch', async (url: string | URL, init: RequestInit) => {
    assert.equal(new URL(url).pathname, '/rest/v1/rpc/apply_garmin_common_push')
    assert.equal(new Headers(init.headers).get('authorization'), 'Bearer service')
    calls.push(JSON.parse(String(init.body)))
    return fail ? Response.json({}, { status: 500 }) : Response.json(1)
  })
  const invoke = (feed: string, payload: unknown, headers: Record<string, string> = {}) =>
    POST(new Request('https://uhl.example/api/garmin/push/' + feed, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-vercel-forwarded-for': '192.0.2.5', ...headers },
      body: JSON.stringify(payload),
    }), { params: Promise.resolve({ feed }) })

  const deregistrations = { deregistrations: [{ userId: permission.userId }] }
  assert.equal((await invoke('unknown', deregistrations)).status, 404)
  assert.equal((await invoke('deregistrations', deregistrations, {
    'x-vercel-forwarded-for': '203.0.113.5', 'x-forwarded-for': '192.0.2.5',
  })).status, 403)
  assert.equal((await invoke('deregistrations', deregistrations, { 'garmin-client-id': 'wrong' })).status, 403)
  assert.equal((await invoke('deregistrations', deregistrations, { 'Content-Type': 'text/plain' })).status, 415)
  assert.equal((await invoke('deregistrations', { deregistrations: [...deregistrations.deregistrations, {}] })).status, 400)
  assert.deepEqual(calls, [])
  assert.equal((await invoke('deregistrations', deregistrations)).status, 503)
  fail = false
  assert.equal((await invoke('deregistrations', deregistrations)).status, 200)
  assert.equal((await invoke('userPermissionsChange', { userPermissionsChange: [permission] })).status, 200)
  assert.deepEqual(calls, [
    ...[1, 2].map(() => ({ p_feed: 'deregistrations', p_items: [{ user_id: permission.userId }] })),
    {
      p_feed: 'userPermissionsChange',
      p_items: [{ user_id: permission.userId, change_time_seconds: changeTimeInSeconds, has_activity_export: false }],
    },
  ])
})
