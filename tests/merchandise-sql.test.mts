import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

const modulePath = process.env.PGLITE_MODULE
const patch = 'UHL-PATCH-001'
const calendar = 'UHL-KAL-2027-A3'

test('merchandise migration isolates the draft and serializes stock and self shipping transitions', { skip: !modulePath }, async () => {
  const { PGlite } = await import(modulePath!)
  const db = new PGlite()
  const actor = randomUUID()
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;')
    for (const migration of [
      '20261103_shop_payments',
      '20261104_shop_catalog_invoices',
      '20261104_shop_fulfillment',
      '20261104_shop_hosted_fulfillment',
      '20261106_fulfillment_tracking',
    ]) {
      await db.exec(await readFile(new URL('../supabase/migrations/' + migration + '.sql', import.meta.url), 'utf8'))
    }
    async function order(quantity: number, sku: string, mode = 'live') {
      const id = randomUUID()
      await db.query(`INSERT INTO shop_orders(id,access_token_hash,provider,mode,quantity,unit_price_cents,
        shipping_cents,total_cents,currency,address,shipping_method_uid,provider_order_id,file_url,file_sha256,product_uid,page_count)
        VALUES($1,'hash','stripe',$2,1,2990,0,2990,'EUR','{}','method',$1::uuid::text,'url','hash','calendar',14)`, [id, mode])
      if (sku === calendar) {
        const { rows } = await db.query('SELECT id FROM shop_order_lines WHERE order_id = $1', [id])
        return { id, line: rows[0].id }
      }
      const { rows } = await db.query(`INSERT INTO shop_order_lines(order_id,line_number,sku,name,quantity,unit_price_cents,total_cents)
        VALUES($1,2,$2,'Patch',$3,600,$3::integer*600) RETURNING id`, [id, sku, quantity])
      return { id, line: rows[0].id }
    }
    const paid = (id: string) => db.query("SELECT shop_record_payment($1,'stripe','live',$1::uuid::text,2990,'EUR',$1::uuid::text)", [id])
    const before = await order(1, calendar)
    await paid(before.id)
    await db.query("INSERT INTO shop_invoices(order_id,number,mode,snapshot,pdf_base64) VALUES($1,'UHL-FIXTURE','live','{}','PDF-FIXTURE')", [before.id])
    const snapshot = async () => (await db.query(`SELECT
      (SELECT jsonb_agg(to_jsonb(o)) FROM shop_orders o) AS orders,
      (SELECT jsonb_agg(to_jsonb(p)) FROM shop_payments p) AS payments,
      (SELECT jsonb_agg(to_jsonb(i)) FROM shop_invoices i) AS invoices,
      (SELECT jsonb_agg(to_jsonb(c)) FROM shop_catalog_products c) AS catalog,
      (SELECT jsonb_agg(to_jsonb(f)) FROM shop_fulfillment f) AS queue`)).rows[0]
    const baseline = await snapshot()
    await db.exec(await readFile(new URL('../supabase/migrations/20261107_shop_merchandise.sql', import.meta.url), 'utf8'))
    assert.deepEqual(await snapshot(), baseline)
    const stock = async () => (await db.query('SELECT stock_on_hand,stock_reserved,stock_sold FROM shop_merchandise WHERE sku=$1', [patch])).rows[0]
    assert.deepEqual(await stock(), { stock_on_hand: 98, stock_reserved: 0, stock_sold: 0 })
    assert.deepEqual((await db.query('SELECT status,price_cents FROM shop_merchandise')).rows, [{ status: 'draft', price_cents: null }])
    assert.equal((await db.query(`SELECT
      has_table_privilege('anon','shop_merchandise','SELECT')
      OR has_table_privilege('authenticated','shop_inventory_entries','UPDATE')
      OR has_function_privilege('authenticated','shop_confirm_self_shipping(uuid,text,uuid,text,text,text)','EXECUTE')
      OR has_function_privilege('anon','shop_reserve_inventory(uuid)','EXECUTE') AS allowed`)).rows[0].allowed, false)

    await db.exec(await readFile(new URL('../supabase/migrations/20261109_shop_shipping_rates.sql', import.meta.url), 'utf8'))
    assert.deepEqual(await snapshot(), baseline)
    assert.deepEqual(await stock(), { stock_on_hand: 98, stock_reserved: 0, stock_sold: 0 })
    const [draft] = (await db.query('SELECT status,price_cents,shipping_config FROM shop_merchandise')).rows
    assert.equal(draft.status, 'draft')
    assert.equal(draft.price_cents, 500)
    assert.deepEqual(draft.shipping_config, {
      rateCodes: ['DP-STANDARD-DE'], domesticOnly: true, countries: [], package: null, standardLetterVerified: false,
    })
    const rates = (await db.query('SELECT code,price_cents,active FROM shop_shipping_rates ORDER BY code')).rows as {
      code: string; price_cents: number | null; active: boolean
    }[]
    assert.equal(rates.length, 7)
    assert.equal(rates.some(rate => rate.active), false)
    assert.deepEqual(rates.filter(rate => rate.price_cents !== null), [{ code: 'DP-STANDARD-DE', price_cents: 95, active: false }])
    assert.equal((await db.query("SELECT has_table_privilege('authenticated','shop_shipping_rates','SELECT,INSERT,UPDATE') AS allowed")).rows[0].allowed, false)
    await assert.rejects(db.exec("UPDATE shop_shipping_rates SET active=true WHERE code='DHL-PAKET'"), /check constraint/)
    await assert.rejects(db.exec("UPDATE shop_shipping_rates SET max_depth_mm=6 WHERE code='DP-STANDARD-DE'"), /check constraint/)

    await db.exec('SET ROLE service_role')
    const adjust = (delta: number, id = randomUUID()) =>
      db.query('SELECT shop_adjust_inventory($1,$2,$3,$4,$5) AS product', [patch, delta, id, actor, 'Inventur'])
    const request = randomUUID()
    const firstAdjustment = await adjust(-97, request)
    assert.equal(firstAdjustment.rows[0].product.stock_on_hand, 1)
    await adjust(-97, request)
    await assert.rejects(adjust(1, request), /conflicts/)
    await db.exec('RESET ROLE')

    const a = await order(1, patch), b = await order(1, patch), sandbox = await order(1, patch, 'test')
    const reserve = (line: string) => db.query('SELECT shop_reserve_inventory($1)', [line])
    const settle = (line: string, target: string, reason: string | null = null) =>
      db.query('SELECT shop_settle_inventory($1,$2,$3)', [line, target, reason])
    await assert.rejects(reserve(a.line), /not an eligible/)
    await db.query("UPDATE shop_merchandise SET status='active',price_cents=600 WHERE sku=$1", [patch])
    await assert.rejects(reserve(sandbox.line), /Pending live order required/)
    const attempts = await Promise.allSettled([reserve(a.line), reserve(b.line)])
    assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1)
    const [winner, next] = attempts[0].status === 'fulfilled' ? [a, b] : [b, a]
    await reserve(winner.line)
    assert.deepEqual(await stock(), { stock_on_hand: 1, stock_reserved: 1, stock_sold: 0 })
    await assert.rejects(adjust(-1), /consume reserved/)
    await assert.rejects(settle(winner.line, 'sold'), /Verified payment/)
    await assert.rejects(settle(winner.line, 'released', 'provider:cancelled'), /Terminal failure evidence/)
    await db.query("UPDATE shop_orders SET status='failed' WHERE id=$1", [winner.id])
    await assert.rejects(settle(winner.line, 'released'), /Terminal failure evidence/)
    await settle(winner.line, 'released', 'provider:cancelled')
    await settle(winner.line, 'released', 'provider:cancelled')
    await reserve(next.line)
    await paid(next.id)
    const queue = await db.query('SELECT * FROM shop_fulfillment WHERE order_id=$1', [next.id])
    await settle(next.line, 'sold')
    await settle(next.line, 'sold')
    assert.deepEqual(await stock(), { stock_on_hand: 0, stock_reserved: 0, stock_sold: 1 })
    assert.deepEqual(await db.query('SELECT * FROM shop_fulfillment WHERE order_id=$1', [next.id]), queue)

    const { rows: [self] } = await db.query("SELECT id FROM shop_fulfillment_units WHERE order_id=$1 AND provider='self'", [next.id])
    const { rows: [gelato] } = await db.query("INSERT INTO shop_fulfillment_units(order_id,mode,provider) VALUES($1,'live','gelato') RETURNING id", [next.id])
    const confirm = (unit: string, state: string, url: string | null = null) =>
      db.query('SELECT shop_confirm_self_shipping($1,$2,$3,$4,$5,$6)', [unit, state, actor, 'DHL', '123', url])
    await assert.rejects(confirm(gelato.id, 'shipped'), /Paid self fulfillment required/)
    await assert.rejects(confirm(self.id, 'delivered'), /Shipment confirmation required/)
    await assert.rejects(confirm(self.id, 'shipped', 'https://user@carrier.example'), /Invalid shipment details/)
    await db.exec('SET ROLE service_role')
    await confirm(self.id, 'shipped', 'https://carrier.example/123')
    await db.exec('RESET ROLE')
    assert.deepEqual((await db.query('SELECT shipping_status,delivery_status,delivered_at FROM shop_fulfillment_shipments')).rows,
      [{ shipping_status: 'shipped', delivery_status: 'unknown', delivered_at: null }])
    await assert.rejects(confirm(self.id, 'shipped'), /already confirmed with different details/)
    await confirm(self.id, 'shipped', 'https://carrier.example/123')
    await confirm(self.id, 'delivered')
    await confirm(self.id, 'delivered')
    assert.deepEqual((await db.query('SELECT shipping_status,delivery_status FROM shop_fulfillment_units WHERE id=$1', [self.id])).rows,
      [{ shipping_status: 'shipped', delivery_status: 'delivered' }])
    assert.deepEqual((await db.query("SELECT event_type, details->>'actor_id' AS actor FROM shop_fulfillment_events ORDER BY event_type")).rows,
      [{ event_type: 'delivered', actor }, { event_type: 'shipped', actor }])
    assert.equal((await db.query('SELECT * FROM shop_fulfillment_sync')).rows.length, 0)
  } finally {
    await db.close()
  }
})
