import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PDFDocument } from 'pdf-lib'
import { addCalendarDays, berlinDate } from '../app/lib/partners/documents'
import { packageEndDate } from '../app/lib/partners/packages'

const runtime = process.env.PGLITE_MODULE
const admin = '11111111-1111-4111-8111-111111111111'
const partner = '22222222-2222-4222-8222-222222222222'
const shopOrder = '33333333-3333-4333-8333-333333333333'

test('partner migration and document route preserve the agreed terms through billing and placement', { skip: !runtime }, async (t) => {
  const { PGlite } = await import(runtime!)
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec(
    "create role anon; create role authenticated; create role service_role; create schema auth; " +
    "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; " +
    "create table partners(id uuid primary key, name text not null); " +
    "create table partner_bookings(id uuid primary key default gen_random_uuid(), partner_id uuid not null references partners, " +
    "booking_type text not null, package_code text not null, package_name text, duration_days integer, status text not null default 'draft', " +
    "start_date date not null, end_date date not null, logo_url text, banner_url text, target_url text, custom_text text, notes text); " +
    "create table events_master(id bigint primary key, slug text, title text, city text); " +
    "create table shop_invoice_counters(year integer, mode text, last_number bigint, primary key(year,mode)); " +
    "create table shop_orders(id uuid primary key, status text, mode text, shipping_cents integer, total_cents integer, address jsonb, currency text, paid_at timestamptz, provider text); " +
    "create table shop_order_lines(order_id uuid, line_number integer, total_cents integer); " +
    "create table shop_invoices(order_id uuid primary key, number text unique, mode text, snapshot jsonb);"
  )
  await db.exec(`
    alter table partners enable row level security;
    alter table partner_bookings enable row level security;
    grant select on partners,partner_bookings to anon;
    create policy "Public can read partners used for active bookings" on partners for select using (true);
    create policy "Public can read active partner bookings" on partner_bookings for select using (true);
  `)
  await db.query('insert into partners values ($1,$2)', [partner, 'Testpartner'])
  await db.query('insert into shop_orders(id,status,mode,shipping_cents,total_cents,address) values ($1,$2,$3,100,1100,$4)', [shopOrder, 'paid', 'live', {}])
  await db.query('insert into shop_order_lines values ($1,1,1000)', [shopOrder])
  const migrations = [
    '20261128_uhl_shared_invoice_number.sql',
    '20261129_uhl_partner_documents.sql',
    '20261130_uhl_partner_placements.sql',
    '20261203_uhl_partner_prices_milestone.sql',
  ]
  for (const migration of migrations.slice(0, 3)) {
    await db.exec(await readFile(new URL('../supabase/migrations/' + migration, import.meta.url), 'utf8'))
  }
  const legacy = (await db.query(
    "insert into partner_bookings(partner_id,booking_type,package_code,start_date,end_date) " +
    "values ($1,'brand_partner','A',date '2026-01-01',date '2026-01-07') returning id", [partner],
  )).rows[0].id
  await db.query('insert into partner_dossiers(booking_id,terms,offer_pdf,offered_by) values ($1,$2,$3,$4)',
    [legacy, { amountCents: 4255, start: '2026-01-01', end: '2026-01-07' }, 'legacy-offer', admin])
  await db.query("update partner_bookings set end_date=date '2026-01-08' where id=$1", [legacy])
  const migration = await readFile(new URL('../supabase/migrations/' + migrations[3], import.meta.url), 'utf8')
  await assert.rejects(db.exec(migration), /weichen voneinander ab/)
  await db.exec('rollback')
  await db.query("update partner_bookings set end_date=date '2026-01-07' where id=$1", [legacy])
  await assert.rejects(db.exec(migration.replace('commit;', 'select 1/0; commit;')), /division by zero/)
  await db.exec('rollback')
  assert.equal((await db.query("select 1 from information_schema.columns where table_name='partner_bookings' and column_name='agreed_price_cents'")).rows.length, 0)
  await db.exec(migration)
  assert.deepEqual((await db.query(
    'select agreed_price_cents,list_price_cents from partner_bookings where id=$1', [legacy],
  )).rows, [{ agreed_price_cents: 4255, list_price_cents: null }])
  assert.equal((await db.query('select offer_pdf from partner_dossiers where booking_id=$1', [legacy])).rows[0].offer_pdf, 'legacy-offer')

  await db.exec('set role anon')
  assert.deepEqual((await db.query('select * from partners')).rows, [])
  assert.deepEqual((await db.query('select agreed_price_cents from partner_bookings')).rows, [])
  await db.exec('reset role')

  const env = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://partner-fixture.invalid',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon',
    SUPABASE_SERVICE_ROLE_KEY: 'fixture-server',
    SHOP_SELLER_TAX_NUMBER: 'fixture-tax',
  }
  for (const [name, value] of Object.entries(env)) {
    const previous = process.env[name]
    process.env[name] = value
    t.after(() => { if (previous === undefined) delete process.env[name]; else process.env[name] = previous })
  }
  const json = (value: unknown, status = 200) => Response.json(value, { status })
  let failInvoiceArchiveOnce = true
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, options?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input)
    assert.equal(url.origin, env.NEXT_PUBLIC_SUPABASE_URL)
    const method = options?.method ?? 'GET'
    const body = typeof options?.body === 'string' ? JSON.parse(options.body) : null
    if (url.pathname === '/auth/v1/user') return json({ id: admin })
    if (url.pathname === '/rest/v1/admin_users') return json([{ user_id: admin }])
    try {
      const table = url.pathname.split('/').at(-1)!
      if (url.pathname.includes('/rpc/')) {
        assert.ok(['uhl_issue_partner_invoice', 'uhl_approve_partner_placement', 'uhl_revoke_partner_placement'].includes(table))
        const parameters = Object.values(body)
        const placeholders = parameters.map((_, index) => '$' + (index + 1)).join(',')
        return json((await db.query('select * from ' + table + '(' + placeholders + ')', parameters)).rows)
      }
      assert.ok(['partner_bookings', 'partner_dossiers', 'partner_cooperations', 'partner_placement_approvals', 'partner_social_mentions'].includes(table))
      const keys = Object.keys(body ?? {})
      const params = Object.values(body ?? {})
      const filters: string[] = []
      for (const [key, value] of url.searchParams) {
        if (key === 'select') continue
        assert.match(key, /^[a-z_]+$/)
        if (value === 'is.null') filters.push(key + ' is null')
        else {
          const operators = { eq: '=', neq: '<>', lte: '<=' }
          const operator = operators[value.split('.')[0] as keyof typeof operators]
          assert.ok(operator)
          filters.push(key + operator + '$' + params.push(value.slice(value.indexOf('.') + 1)))
        }
      }
      const where = filters.length ? ' where ' + filters.join(' and ') : ''
      const selected = url.searchParams.get('select')
      const columns = selected?.replace('partners(name)', "(select jsonb_build_object('name',name) from partners where id=partner_bookings.partner_id) as partners")
      if (method === 'GET') {
        const result = await db.query('select ' + columns + ' from ' + table + where, params)
        for (const field of result.fields as { name: string; dataTypeID: number }[]) {
          if (field.dataTypeID === 1082) {
            for (const row of result.rows) {
              if (row[field.name] instanceof Date) row[field.name] = row[field.name].toISOString().slice(0, 10)
            }
          }
        }
        if (new Headers(options?.headers).get('accept')?.includes('vnd.pgrst.object')) return json(result.rows[0])
        return json(result.rows)
      }
      assert.ok(keys.every(key => /^[a-z_]+$/.test(key)))
      if (method === 'POST') {
        const values = keys.map((_, index) => '$' + (index + 1))
        await db.query('insert into ' + table + '(' + keys.join(',') + ') values (' + values.join(',') + ')', params)
        return new Response(null, { status: 201 })
      }
      assert.equal(method, 'PATCH')
      if (table === 'partner_dossiers' && keys.includes('invoice_pdf') && failInvoiceArchiveOnce) {
        failInvoiceArchiveOnce = false
        return json({ code: 'XX000', message: 'simulated PDF archive failure' }, 500)
      }
      const sets = keys.map((key, index) => key + '=$' + (index + 1))
      const result = await db.query('update ' + table + ' set ' + sets.join(',') + where + (columns ? ' returning ' + columns : ''), params)
      return columns ? json(result.rows) : new Response(null, { status: 204 })
    } catch (error) {
      const problem = error as { code?: string; message: string }
      return json({ code: problem.code, message: problem.message }, 400)
    }
  })

  const { GET, POST } = await import('../app/api/admin/partners/documents/route')
  const endpoint = 'http://127.0.0.1/api/admin/partners/documents'
  const headers = { authorization: 'Bearer fixture-admin' }
  const today = berlinDate(new Date())
  const end = packageEndDate(today, '7')
  async function booking(price: number | null, code = 'A') {
    const result = await db.query(
      "insert into partner_bookings(partner_id,booking_type,package_code,duration_days,start_date,end_date,agreed_price_cents,list_price_cents,target_url,banner_url,logo_url) " +
      "values ($1,'brand_partner',$2,$3,$4,$5,$6,$7,'https://example.test','https://example.test/banner','https://example.test/logo') returning id",
      [partner, code, code === 'M' ? null : 7, today, end, price, code === 'M' ? 0 : 4900],
    )
    return result.rows[0].id as string
  }
  async function action(id: string, action: string, payload: object, status: number) {
    const response = await POST(new Request(endpoint, { method: 'POST', headers, body: JSON.stringify({ id, action, ...payload }) }))
    assert.equal(response.status, status, action + ' ' + await response.text())
  }
  async function pdf(id: string, file: string) {
    const response = await GET(new Request(endpoint + '?id=' + id + '&file=' + file, { headers }))
    assert.equal(response.status, 200)
    const bytes = Buffer.from(await response.arrayBuffer())
    assert.ok((await PDFDocument.load(bytes)).getPageCount() > 0)
    return bytes.toString('base64')
  }
  const offer = { recipient: 'Testempfänger', address: 'Musterstraße 1', date: addCalendarDays(today, 10) }
  const cooperation = { kind: 'goodwill', explanation: 'Testvereinbarung', termKind: 'minimum', minimumEnd: end }
  const unknown = await booking(null)
  await action(unknown, 'offer', offer, 409)
  await action(unknown, 'record-cooperation', cooperation, 409)
  await assert.rejects(db.query(
    "insert into partner_cooperations(booking_id,kind,explanation,term_kind,agreed_start,fixed_end,recorded_by) values ($1,'goodwill','Test','fixed',$2,$3,$4)",
    [unknown, today, end, admin],
  ), /erfordert 0,00/)
  await db.query('update partner_bookings set agreed_price_cents=7355 where id=$1', [unknown])
  await action(unknown, 'offer', offer, 201)
  const archivedOffer = await pdf(unknown, 'offer')
  await action(unknown, 'offer', offer, 409)
  await assert.rejects(db.query('update partner_bookings set end_date=end_date+1 where id=$1', [unknown]), /dokumentiert/)
  await assert.rejects(db.query('update partner_bookings set agreed_price_cents=0 where id=$1', [unknown]), /dokumentiert/)
  await db.query("update partner_bookings set notes='Interne Notiz' where id=$1", [unknown])
  await action(unknown, 'request-payment', { days: 7 }, 409)
  await action(unknown, 'accept', { date: today, contract: archivedOffer }, 200)
  await action(unknown, 'accept', { date: today, contract: archivedOffer }, 409)
  assert.equal(await pdf(unknown, 'contract'), archivedOffer)
  await action(unknown, 'request-payment', { days: 7 }, 200)
  const payment = await pdf(unknown, 'payment')
  await action(unknown, 'request-payment', { days: 14 }, 409)
  assert.equal(await pdf(unknown, 'payment'), payment)
  await action(unknown, 'confirm-payment', { date: today, cents: 4900, note: 'Test' }, 400)
  await action(unknown, 'confirm-payment', { date: today, cents: 7355, note: 'Test' }, 200)
  await action(unknown, 'confirm-payment', { date: today, cents: 7355, note: 'Test' }, 409)
  assert.equal((await GET(new Request(endpoint + '?id=' + unknown + '&file=invoice-draft'))).status, 403)
  await pdf(unknown, 'invoice-draft')
  assert.equal((await db.query('select * from shop_invoice_counters')).rows.length, 0)
  assert.equal((await db.query('select invoice_number from partner_dossiers where booking_id=$1', [unknown])).rows[0].invoice_number, null)
  await db.query('select * from shop_issue_invoice($1,$2,$3)', [shopOrder, { taxNumber: 'test' }, {}])
  await action(unknown, 'invoice', {}, 500)
  const reserved = (await db.query('select invoice_number, invoice_pdf from partner_dossiers where booking_id=$1', [unknown])).rows[0]
  assert.match(reserved.invoice_number, /^UHL-\d{4}-000002$/)
  assert.equal(reserved.invoice_pdf, null)
  await action(unknown, 'invoice', {}, 200)
  const invoice = await pdf(unknown, 'invoice')
  await action(unknown, 'invoice', {}, 200)
  assert.equal(await pdf(unknown, 'invoice'), invoice)
  assert.equal(await pdf(unknown, 'offer'), archivedOffer)
  const [dossier] = (await db.query('select terms,invoice_number,paid_cents from partner_dossiers where booking_id=$1', [unknown])).rows
  assert.equal(dossier.terms.amountCents, 7355)
  assert.equal(dossier.terms.listPriceCents, 4900)
  assert.equal(dossier.paid_cents, 7355)
  assert.match(dossier.invoice_number, /^UHL-\d{4}-000002$/)
  assert.equal((await db.query('select last_number::integer from shop_invoice_counters')).rows[0].last_number, 2)
  await action(unknown, 'approve-placement', { eventIds: [] }, 200)
  await action(unknown, 'approve-placement', { eventIds: [] }, 409)
  await action(unknown, 'revoke-placement', { reason: 'Test' }, 200)

  for (const column of ['offer_pdf', 'contract_pdf', 'payment_request_pdf', 'invoice_pdf']) {
    await assert.rejects(db.query('update partner_dossiers set ' + column + "='changed' where booking_id=$1", [unknown]), /Archivierte/)
  }
  await assert.rejects(db.query("update partner_bookings set package_code='B' where id=$1", [unknown]), /dokumentiert/)

  const cancelled = await booking(7355)
  await action(cancelled, 'offer', offer, 201)
  const cancelledOffer = await pdf(cancelled, 'offer')
  await action(cancelled, 'accept', { date: today, contract: cancelledOffer }, 200)
  await action(cancelled, 'record-cancellation', { reason: 'Extern dokumentiert' }, 409)
  await db.query('update partner_dossiers set payment_requested_at=$2,payment_due_on=$3,payment_request_pdf=$4 where booking_id=$1',
    [cancelled, addCalendarDays(today, -2) + 'T12:00:00Z', addCalendarDays(today, -1), payment])
  await action(cancelled, 'record-cancellation', { reason: '' }, 400)
  await action(cancelled, 'record-cancellation', { reason: 'Extern dokumentiert' }, 200)
  await action(cancelled, 'record-cancellation', { reason: 'Zweiter Versuch' }, 409)
  await action(cancelled, 'confirm-payment', { date: today, cents: 7355, note: 'Test' }, 409)
  await action(cancelled, 'invoice', {}, 409)
  await action(cancelled, 'approve-placement', { eventIds: [] }, 409)
  assert.equal(await pdf(cancelled, 'offer'), cancelledOffer)
  assert.equal(await pdf(cancelled, 'payment'), payment)
  await assert.rejects(db.query('update partner_dossiers set paid_on=$2 where booking_id=$1', [cancelled, today]), /partner_dossier_cancellation_complete/)
  await assert.rejects(db.query("update partner_dossiers set cancellation_reason='changed' where booking_id=$1", [cancelled]), /Archivierte/)
  assert.equal((await db.query('select last_number::integer from shop_invoice_counters')).rows[0].last_number, 2)

  const free = await booking(0)
  await action(free, 'offer', offer, 400)
  await action(free, 'record-cooperation', cooperation, 201)
  await action(free, 'record-cooperation', cooperation, 409)
  await assert.rejects(db.query('update partner_bookings set start_date=start_date+1 where id=$1', [free]), /dokumentiert/)
  await action(free, 'approve-placement', { eventIds: [] }, 200)
  await action(free, 'close-partnership', { date: today }, 200)
  assert.equal((await db.query('select effective_end::text from partner_cooperations where booking_id=$1', [free])).rows[0].effective_end, end)

  const milestone = await booking(0, 'M')
  await action(milestone, 'record-cooperation', cooperation, 400)
  await action(milestone, 'approve-placement', { eventIds: [] }, 200)
  assert.equal((await db.query("select booking_id from uhl_partner_ads('milestone')")).rows[0].booking_id, milestone)
  await action(milestone, 'revoke-placement', { reason: 'Test' }, 200)
  assert.equal((await db.query("select booking_id from uhl_partner_ads('milestone')")).rows.length, 0)
})
