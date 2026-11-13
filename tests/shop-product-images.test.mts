import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://storage.example.com'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'server'
const { POST } = await import('../app/api/admin/shop/products/images/route')
const { managedImagePath, moveProductImage } = await import('../app/lib/shop/product-images')

test('image order, main image, removal and private reference parsing', () => {
  const ordered = moveProductImage(['cover', 'detail', 'rear'], 2, 0)
  assert.deepEqual(ordered, ['rear', 'cover', 'detail'])
  assert.deepEqual(ordered.filter(image => image !== 'rear'), ['cover', 'detail'])
  const url = 'https://storage.example.com/storage/v1/object/shop-product-images/UHL-PATCH-001/f55266ac-fc1f-4ee9-8a29-f163ab04bab5.webp'
  assert.match(managedImagePath(url)!, /^UHL-PATCH-001\//)
  assert.equal(managedImagePath(url.replace('storage.example.com', 'other.example.com')), null)
})

test('only admins upload, valid formats become bounded WebP, and invalid files never reach storage', async () => {
  const original = globalThis.fetch
  let admin = false
  const uploaded: string[] = []
  const origin = 'https://shop.example.com'
  const endpoint = origin + '/api/admin/shop/products/images'
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    if (url.pathname === '/auth/v1/user') return Response.json({ id: 'actor', aud: 'authenticated' })
    if (url.pathname.endsWith('/admin_users')) return Response.json(admin ? { user_id: 'actor' } : null)
    if (url.pathname.startsWith('/storage/v1/object/sign/')) {
      const { paths } = JSON.parse(String(init?.body))
      assert.deepEqual(paths, uploaded)
      return Response.json(paths.map((path: string) => ({ path, signedURL: '/object/sign/shop-product-images/' + path + '?token=test' })))
    }
    const prefix = '/storage/v1/object/shop-product-images/'
    assert.ok(url.pathname.startsWith(prefix))
    const meta = await sharp(Buffer.from(init?.body as Uint8Array)).metadata()
    assert.equal(meta.format, 'webp')
    assert.ok(meta.width! <= 1800)
    assert.equal(meta.exif, undefined)
    uploaded.push(url.pathname.slice(prefix.length))
    return Response.json({ Key: url.pathname.slice(prefix.length) })
  }
  function request(file: Blob, from = origin) {
    const form = new FormData()
    form.set('sku', 'UHL-PATCH-001')
    form.set('image', file, 'test-image')
    return new Request(endpoint, { method: 'POST', headers: { Origin: from, Authorization: 'Bearer token' }, body: form })
  }
  const image = sharp({ create: { width: 2100, height: 1200, channels: 3, background: '#257145' } })
  const png = new Blob([new Uint8Array(await image.clone().png().toBuffer())], { type: 'image/png' })
  try {
    assert.equal((await POST(request(png))).status, 403)
    admin = true
    assert.equal((await POST(request(png, 'https://evil.example'))).status, 403)
    assert.equal((await POST(request(new Blob(['bad'], { type: 'image/png' })))).status, 422)
    assert.equal((await POST(request(new Blob(['<svg/>'], { type: 'image/svg+xml' })))).status, 415)
    assert.equal((await POST(request(new Blob([new Uint8Array(4 * 1024 * 1024 + 1)], { type: 'image/png' })))).status, 413)
    assert.equal(uploaded.length, 0)
    const jpeg = new Blob([new Uint8Array(await image.clone().jpeg().toBuffer())], { type: 'image/jpeg' })
    const webp = new Blob([new Uint8Array(await image.clone().webp().toBuffer())], { type: 'image/webp' })
    const urls: string[] = []
    for (const file of [png, jpeg, webp]) {
      const result = await POST(request(file))
      assert.equal(result.status, 201)
      urls.push((await result.json()).url)
    }
    assert.equal(new Set(uploaded).size, 3)
    assert.deepEqual(urls.map(url => managedImagePath(url)), uploaded)
    const preview = await POST(new Request(endpoint, {
      method: 'POST', headers: { Origin: origin, Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls }),
    }))
    assert.equal(preview.status, 200)
    assert.equal(Object.keys((await preview.json()).previews).length, 3)
  } finally {
    globalThis.fetch = original
  }
})

test('restrictive storage policy denies even broad authenticated upload grants only for the product bucket', {
  skip: !process.env.PGLITE_MODULE,
}, async () => {
  const { readFile } = await import('node:fs/promises')
  const { PGlite } = await import(process.env.PGLITE_MODULE!)
  const db = new PGlite()
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA storage; CREATE TABLE storage.objects(bucket_id text, name text);
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
      GRANT SELECT, INSERT ON storage.objects TO anon, authenticated, service_role;
      CREATE POLICY legacy_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (true);
      CREATE POLICY legacy_select ON storage.objects FOR SELECT TO anon, authenticated USING (true);
    `)
    const migration = new URL('../supabase/migrations/20261108_shop_product_images_access.sql', import.meta.url)
    await db.exec(await readFile(migration, 'utf8'))
    await db.exec("SET ROLE authenticated; INSERT INTO storage.objects VALUES('claim-proofs','existing')")
    await assert.rejects(db.exec("INSERT INTO storage.objects VALUES('shop-product-images','unauthorized')"), /row-level security/)
    await db.exec("SET ROLE service_role; INSERT INTO storage.objects VALUES('shop-product-images','admin-upload')")
    await db.exec('SET ROLE authenticated')
    assert.deepEqual((await db.query('SELECT name FROM storage.objects')).rows, [{ name: 'existing' }])
  } finally {
    await db.close()
  }
})
