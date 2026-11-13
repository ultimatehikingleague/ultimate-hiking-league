import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { isLocalActivityImport } from '../../lib/activity/development'
import { maxActivityBytes, parseActivity } from '../../lib/activity/parse'

const bucket = 'activity-originals'
const referencePrefix = 'activity-original:'

async function authenticate(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const enabled = isLocalActivityImport(url) ||
    (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_ACTIVITY_IMPORT_ENABLED === 'true')
  if (!url || !key || !serviceKey || !enabled) return new Response(null, { status: 404 })
  const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1]
  if (!token) return new Response(null, { status: 401 })
  const auth = { persistSession: false, autoRefreshToken: false }
  const db = createClient(url, key, { auth, global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: { user }, error } = await db.auth.getUser(token)
  if (error || !user) return new Response(null, { status: 401 })
  const storage = createClient(url, serviceKey, { auth }).storage.from(bucket)
  return { db, user, storage }
}

async function readFile(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) throw Error('Keine Datei übermittelt.')
  const chunks: Uint8Array[] = []
  let bytes = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      bytes += value.length
      if (bytes > maxActivityBytes) {
        await reader.cancel()
        throw Error('Die Aktivitätsdatei darf maximal 4 MB groß sein.')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks, bytes)
}

async function importFile(request: Request, save: boolean) {
  if (process.env.NEXT_PUBLIC_ACTIVITY_GPS_ENABLED !== 'true') return new Response(null, { status: 404 })
  const access = await authenticate(request)
  if (access instanceof Response) return access
  let bytes: Buffer
  let activity: ReturnType<typeof parseActivity>
  try {
    bytes = await readFile(request)
    activity = parseActivity(bytes, new URL(request.url).searchParams.get('format') ?? '')
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Datei konnte nicht gelesen werden.' }, { status: 400 })
  }
  const digest = createHash('sha256').update(bytes).digest('hex')
  const path = `${access.user.id}/${digest}.${activity.format}`
  const attempt = new URL(request.url).searchParams.get('attempt')
  if (save && !attempt?.match(/^[a-f0-9-]{36}$/)) return new Response(null, { status: 400 })
  const reference = `${referencePrefix}${path}#${attempt ?? ''}`
  const { data: existing, error: lookupError } = await access.db.from('record_submissions')
    .select('id').eq('user_id', access.user.id).like('proof_image_url', `${referencePrefix}${path}#%`).limit(1)
  if (lookupError) return Response.json({ error: 'Die Einreichungen konnten nicht geprüft werden.' }, { status: 503 })
  if (save) {
    const { error } = await access.storage.upload(path, bytes, {
      upsert: true, contentType: 'application/octet-stream', cacheControl: '0',
    })
    if (error) return Response.json({ error: 'Die Originaldatei konnte nicht gespeichert werden.' }, { status: 503 })
  }
  return Response.json({ activity, reference, repeated: Boolean(existing?.length) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  return importFile(request, false)
}

export async function PUT(request: Request) {
  return importFile(request, true)
}

export async function GET(request: Request) {
  const access = await authenticate(request)
  if (access instanceof Response) return access
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('submission')
  if (!id || !/^\d+$/.test(id)) return new Response(null, { status: 400 })
  // The session-scoped query applies the existing owner/admin policies.
  const { data, error } = await access.db.from('record_submissions')
    .select('user_id, proof_image_url').eq('id', id).maybeSingle()
  if (error || !data?.proof_image_url?.startsWith(referencePrefix)) return new Response(null, { status: 404 })
  const path = data.proof_image_url.slice(referencePrefix.length).split('#')[0]
  const [owner, file, extra] = path.split('/')
  if (owner !== data.user_id || extra !== undefined || !/^[a-f0-9]{64}\.(gpx|fit|tcx)$/.test(file ?? '')) {
    return new Response(null, { status: 404 })
  }
  const { data: original, error: downloadError } = await access.storage.download(path)
  if (downloadError || !original) return new Response(null, { status: 404 })
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }
  if (searchParams.get('download') === '1') {
    return new Response(original, {
      headers: { ...headers, 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="aktivitaet.${file.split('.')[1]}"` },
    })
  }
  try {
    const activity = parseActivity(new Uint8Array(await original.arrayBuffer()), file)
    const { data: matches } = await access.db.from('record_submissions')
      .select('id').eq('user_id', owner).like('proof_image_url', `${referencePrefix}${path}#%`).neq('id', id).limit(1)
    return Response.json({ activity, repeated: Boolean(matches?.length) }, { headers })
  } catch {
    return Response.json({ error: 'Die gespeicherte Originaldatei konnte nicht ausgewertet werden.' }, { status: 422, headers })
  }
}
