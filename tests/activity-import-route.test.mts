import assert from 'node:assert/strict'
import { test } from 'node:test'
import { GET, POST, PUT } from '../app/api/activity-import/route'

test('private upload, preview, and downloads respect environment and submission access', async t => {
  const env = process.env
  process.env = {
    ...env,
    NODE_ENV: 'development',
    NEXT_PUBLIC_ACTIVITY_IMPORT_ENABLED: 'true',
    NEXT_PUBLIC_ACTIVITY_GPS_ENABLED: 'true',
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service',
  }
  t.after(() => { process.env = env })

  const user = 'd6b7b075-d54f-4f8a-bc92-392c64b49f93'
  const body = '<gpx><trk><trkseg><trkpt lat="47" lon="11"/><trkpt lat="47.001" lon="11"/></trkseg></trk></gpx>'
  const file = `${'a'.repeat(64)}.gpx`
  let visible = false
  let proofOwner = user
  let uploaded = 0
  let downloaded = 0
  let repeated = false

  t.mock.method(globalThis, 'fetch', async (input: string | URL, init: RequestInit) => {
    const { pathname, searchParams } = new URL(input)
    const headers = new Headers(init.headers)
    if (pathname === '/auth/v1/user') {
      assert.equal(headers.get('authorization'), 'Bearer session')
      return Response.json({ id: user })
    }
    if (pathname === '/rest/v1/record_submissions') {
      assert.equal(headers.get('authorization'), 'Bearer session')
      if (searchParams.get('id')?.startsWith('eq.')) {
        return Response.json(visible ? [{ user_id: user, proof_image_url: `activity-original:${proofOwner}/${file}#attempt` }] : [])
      }
      assert.equal(searchParams.get('user_id'), `eq.${user}`)
      return Response.json(repeated ? [{ id: 99 }] : [])
    }
    assert.equal(headers.get('authorization'), 'Bearer test-service')
    if (pathname.includes('/storage/v1/object/activity-originals/') && init.method === 'POST') {
      assert.ok(pathname.includes(user))
      uploaded++
      return Response.json({ Key: 'activity-originals/file' })
    }
    assert.ok(pathname.includes('/storage/v1/object/'))
    downloaded++
    return new Response(body)
  })

  const endpoint = 'http://localhost/api/activity-import'
  const headers = { Authorization: 'Bearer session' }
  const attempt = '2ed80d0d-e849-48bc-908f-dab8992de7bf'
  const upload = () => PUT(new Request(`${endpoint}?format=gpx&attempt=${attempt}`, { method: 'PUT', body, headers }))
  const download = () => GET(new Request(`${endpoint}?submission=17&download=1`, { headers }))
  assert.equal((await POST(new Request(endpoint, { method: 'POST', body }))).status, 401)
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://production.example.com'
  assert.equal((await upload()).status, 404)
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'

  const preview = await POST(new Request(`${endpoint}?format=gpx`, { method: 'POST', body, headers }))
  assert.equal(preview.status, 200)
  assert.equal((await preview.json()).activity.eligibility, 'unknown')
  assert.equal(uploaded, 0)

  const first = await upload()
  assert.equal(first.status, 200)
  repeated = true
  const second = await upload()
  assert.equal(second.status, 200)
  const [firstResult, secondResult] = await Promise.all([first.json(), second.json()])
  assert.equal(firstResult.reference, secondResult.reference)
  assert.equal(secondResult.repeated, true)

  assert.equal((await download()).status, 404)
  assert.equal(downloaded, 0)
  visible = true
  proofOwner = 'some-other-user'
  assert.equal((await download()).status, 404)
  assert.equal(downloaded, 0)
  proofOwner = user
  const original = await download()
  assert.equal(original.status, 200)
  assert.equal(original.headers.get('cache-control'), 'private, no-store')
  assert.equal(original.headers.get('content-disposition'), 'attachment; filename="aktivitaet.gpx"')
  assert.equal(await original.text(), body)
})
