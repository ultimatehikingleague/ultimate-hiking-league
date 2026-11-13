import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { synchronizeInvoiceBackup } from '../app/lib/shop/invoice-backup'

const existing = 'UHL-2026-000001'
const missing = 'UHL-2026-000002'
const corrupt = 'UHL-2026-000003'
const unavailable = 'UHL-2026-000004'
const bytes = '%PDF-1.7\nfixture'
const sha = createHash('sha256').update(bytes).digest('hex')
const checksum = (number: string) => `${sha}  ${number}.pdf\n`

test('manual backup verifies old sidecars, downloads missing PDFs only, and never replaces a conflict', async () => {
  const files = new Map<string, Blob>([
    [existing + '.pdf', new Blob([bytes])],
    [existing + '.pdf.sha256', new Blob([checksum(existing)])],
    [corrupt + '.pdf', new Blob(['%PDF-1.7\ndifferent'])],
    [corrupt + '.pdf.sha256', new Blob([checksum(corrupt)])],
  ])
  const folder = {
    async getDirectoryHandle() { return folder },
    async getFileHandle(name: string, options?: { create?: boolean }) {
      if (!files.has(name)) {
        if (!options?.create) throw new DOMException('Missing', 'NotFoundError')
        files.set(name, new Blob())
      }
      return {
        getFile: async () => files.get(name),
        async createWritable(options: { mode: string }) {
          assert.equal(options.mode, 'exclusive')
          let content: Blob
          return {
            async write(data: BlobPart) { content = new Blob([data]) },
            async close() { files.set(name, content) },
            async abort() {},
          }
        },
      }
    },
  } as unknown as FileSystemDirectoryHandle
  const requested: string[] = []
  const read = async (params: URLSearchParams) => {
    const number = params.get('number')
    if (!number) {
      return params.has('after')
        ? Response.json({ numbers: [corrupt, unavailable], next: null })
        : Response.json({ numbers: [existing, missing], next: missing })
    }
    requested.push(number)
    if (number === unavailable) return new Response(null, { status: 404 })
    return new Response(bytes, { headers: { 'Content-Type': 'application/pdf', 'X-Invoice-SHA256': sha } })
  }

  assert.deepEqual(await synchronizeInvoiceBackup(folder, read), {
    added: 1, existing: 1, failed: [corrupt, unavailable], incomplete: false,
  })
  assert.deepEqual(requested, [missing, unavailable])
  assert.equal(await files.get(missing + '.pdf')?.text(), bytes)
  assert.equal(await files.get(missing + '.pdf.sha256')?.text(), checksum(missing))
  assert.equal(await files.get(corrupt + '.pdf')?.text(), '%PDF-1.7\ndifferent')
  requested.length = 0
  assert.deepEqual(await synchronizeInvoiceBackup(folder, read), {
    added: 0, existing: 2, failed: [corrupt, unavailable], incomplete: false,
  })
  assert.deepEqual(requested, [unavailable])
})

test('manual backup API checks administrator access before reading LIVE invoice data', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://database.example.com'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service'
  const { GET } = await import('../app/api/admin/shop/invoice-backup/route')
  const original = globalThis.fetch
  let administrator = false
  const queries: URL[] = []
  globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : null
    const url = new URL(request?.url || String(input))
    assert.equal(init?.method || request?.method || 'GET', 'GET')
    if (url.pathname === '/auth/v1/user') return Response.json({ id: 'fixture-user', aud: 'authenticated' })
    if (url.pathname.endsWith('/admin_users')) return Response.json(administrator ? { user_id: 'fixture-user' } : null)
    if (url.pathname.endsWith('/shop_invoices')) {
      queries.push(url)
      assert.equal(url.searchParams.get('mode'), 'eq.live')
      if (url.searchParams.get('select') === 'number') return Response.json([{ number: existing }])
      assert.equal(url.searchParams.get('select'), 'pdf_base64')
      assert.equal(url.searchParams.get('number'), 'eq.' + existing)
      return Response.json({ pdf_base64: Buffer.from(bytes).toString('base64') })
    }
    throw Error('Unexpected request')
  }
  const request = (query = '', authenticated = true) => new Request('https://www.ultimatehikingleague.com/api/admin/shop/invoice-backup' + query, {
    headers: authenticated ? { Authorization: 'Bearer session' } : {},
  })
  try {
    assert.equal((await GET(request('', false))).status, 403)
    assert.equal((await GET(request('?number=' + existing))).status, 403)
    assert.equal(queries.length, 0)
    administrator = true
    assert.equal((await GET(request('?number=../../file'))).status, 400)
    const list = await GET(request())
    assert.equal(list.status, 200)
    assert.deepEqual(await list.json(), { numbers: [existing], next: null })
    const pdf = await GET(request('?number=' + existing))
    assert.equal(pdf.status, 200)
    assert.match(pdf.headers.get('cache-control')!, /private, no-store/)
    assert.equal(pdf.headers.get('x-invoice-sha256'), sha)
    assert.equal(await pdf.text(), bytes)
    assert.equal(queries.length, 2)
  } finally {
    globalThis.fetch = original
  }
})
