import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const runtime = process.env.PGLITE_MODULE
if (!runtime) throw Error('PGLITE_MODULE is required for the isolated shop voucher tests')
const { PGlite } = await import(runtime)
const sku = 'UHL-KAL-2027-A3'
const otherSku = 'VOUCHER-OTHER-SKU'

test('Outdoor Store vouchers: isolated PostgreSQL checkout, payment and fulfillment', async t => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')

  for (const migration of [
    '20261103_shop_payments', '20261104_shop_catalog_invoices', '20261104_shop_fulfillment',
    '20261104_shop_hosted_fulfillment', '20261128_uhl_shared_invoice_number',
  ]) {
    await db.exec(await readFile(new URL('../supabase/migrations/' + migration + '.sql', import.meta.url), 'utf8'))
  }
  const order = (provider = 'paypal', discount = 1000, shipping = 450) => ({
    id: randomUUID(), access_token_hash: 'synthetic', provider, mode: 'test', sku, product_name: 'Synthetic product',
    quantity: 2, unit_price_cents: 3000, shipping_cents: shipping, total_cents: 6000 + shipping - discount,
    currency: 'EUR', address: { country: 'DE' }, shipping_method_uid: 'standard',
    file_url: 'https://fixture.invalid/calendar.pdf', file_sha256: 'fixture', product_uid: 'fixture', page_count: 14,
  })
  const legacy = order('paypal', 0)
  await db.query('insert into shop_orders select (jsonb_populate_record(null::shop_orders,$1)).*', [
    JSON.stringify({ ...legacy, status: 'pending', created_at: new Date().toISOString() }),
  ])
  await db.exec(await readFile(new URL('../supabase/migrations/20261205_shop_vouchers.sql', import.meta.url), 'utf8'))
  await db.exec(`
    insert into shop_catalog_products values ('${otherSku}','Other',3000,'EUR',true,'fixture','fixture','fixture',14);
    insert into shop_vouchers(code,mode,kind,value,sku,minimum_cents,usage_limit) values
     ('ONE-USE','test','fixed',1000,'${sku}',5000,1),
     ('FULL-OFF','test','percent',100,null,0,2),
     ('ROUND','test','percent',33,null,0,null),
     ('FIXED-CAP','test','fixed',9999,null,0,null),
     ('STRIPE-EXPIRY','test','fixed',1000,null,0,1),
     ('PAYPAL-CLAIM','test','fixed',1000,null,0,1);
    insert into shop_vouchers(code,mode,kind,value,starts_at,ends_at,active) values
     ('FUTURE','test','fixed',10,now()+interval '1 day',null,true),
     ('EXPIRED','test','fixed',10,null,now()-interval '1 day',true),
     ('DISABLED','test','fixed',10,null,null,false);
  `)

  const reserve = (o, code, discount) => db.query('select shop_reserve_voucher_order($1,$2,$3)', [JSON.stringify(o), code, discount])
  const price = async (code, product = sku, subtotal = 6000, mode = 'test') =>
    (await db.query('select shop_voucher_discount($1,$2,$3,$4) as discount', [code, product, subtotal, mode])).rows[0].discount
  const release = (id, final) => db.query('select shop_release_voucher_order($1,$2)', [id, final])
  const saved = async id => (await db.query('select * from shop_orders where id=$1', [id])).rows[0]
  const backdate = id => db.query("update shop_orders set voucher_expires_at=now()-interval '1 minute' where id=$1", [id])
  const pay = (o, payment, amount, providerOrderId) => db.query("select shop_record_payment($1,$2,'test',$3,$4,'EUR',$5)", [o.id, o.provider, payment, amount, providerOrderId])

  await t.test('migration preserves legacy orders and access is limited to the service role', async () => {
    assert.equal((await saved(legacy.id)).discount_cents, 0)
    await db.exec('set role anon')
    await assert.rejects(price('ONE-USE'), /permission denied/)
    await assert.rejects(db.query('select * from shop_vouchers'), /permission denied/)
    await db.exec('set role service_role')
    assert.equal(await price('ONE-USE'), 1000)
  })

  await t.test('server validates eligibility, exact cents and date windows', async () => {
    assert.equal(await price('ROUND', sku, 101), 33)
    assert.equal(await price('FIXED-CAP'), 6000)
    assert.equal(await price('ONE-USE', sku, 5000), 1000)
    await assert.rejects(price('ONE-USE', otherSku), /voucher_unavailable/)
    await assert.rejects(price('ONE-USE', sku, 4999), /voucher_unavailable/)
    for (const code of ['UNKNOWN', 'FUTURE', 'EXPIRED', 'DISABLED']) await assert.rejects(price(code), /voucher_unavailable/)
    await assert.rejects(reserve(order(), 'ONE-USE', 999), /voucher_unavailable/)
  })

  await t.test('competing submissions, reservation release, payment match and retry', async () => {
    const attempts = [order(), order()]
    const results = await Promise.allSettled(attempts.map(o => reserve(o, 'ONE-USE', 1000)))
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
    const first = attempts[results.findIndex(result => result.status === 'fulfilled')]
    assert.equal((await saved(first.id)).status, 'pending')
    await assert.rejects(price('ONE-USE', sku, 6000, 'live'), /voucher_unavailable/)
    await assert.rejects(price('ONE-USE'), /voucher_unavailable/)
    await reserve(first, 'ONE-USE', 1000)
    await release(first.id, false)
    assert.equal((await saved(first.id)).status, 'pending')
    await backdate(first.id)
    await release(first.id, false)
    assert.equal((await saved(first.id)).status, 'failed')

    const second = order()
    await reserve(second, 'ONE-USE', 1000)
    await db.query("update shop_orders set provider_order_id='provider-paypal' where id=$1", [second.id])
    await assert.rejects(pay(second, 'pay-1', 5451, 'provider-paypal'), /Payment mismatch/)
    await pay(second, 'pay-1', 5450, 'provider-paypal')
    await pay(second, 'pay-1', 5450, 'provider-paypal')
    await release(second.id, true)
    assert.equal((await saved(second.id)).status, 'paid')
    await assert.rejects(price('ONE-USE'), /voucher_unavailable/)
    const list = (await db.query("select shop_admin_voucher_list('ONE-','test') as row")).rows
    assert.equal(list.find(({ row }) => row.code === 'ONE-USE').row.status, 'exhausted')
  })

  await t.test('100 percent preserves shipping and 0-EUR orders close exactly once with invoice and Gelato handoff', async () => {
    const shippingOnly = order('stripe', 6000)
    const free = order('paypal', 6000, 0)
    await reserve(shippingOnly, 'FULL-OFF', 6000)
    assert.equal((await saved(shippingOnly.id)).total_cents, 450)
    await reserve(free, 'FULL-OFF', 6000)
    await reserve(free, 'FULL-OFF', 6000)
    const result = await saved(free.id)
    assert.equal(result.provider, 'free')
    assert.equal(result.status, 'paid')
    assert.equal(result.total_cents, 0)
    assert.deepEqual((await db.query('select provider,amount_cents from shop_payments where order_id=$1', [free.id])).rows, [
      { provider: 'free', amount_cents: 0 },
    ])
    assert.deepEqual((await db.query('select mode,status from shop_fulfillment where order_id=$1', [free.id])).rows, [
      { mode: 'test', status: 'pending' },
    ])
    const invoice = (await db.query("select snapshot,number from shop_issue_invoice($1,'{}','{}')", [free.id])).rows[0]
    assert.match(invoice.number, /^TEST-/)
    assert.equal(invoice.snapshot.discountCents, 6000)
    assert.equal(invoice.snapshot.totalCents, 0)
    assert.equal(invoice.snapshot.lines[0].total_cents, 6000)
    await assert.rejects(reserve(order('paypal', 6000), 'FULL-OFF', 6000), /voucher_unavailable/)
  })

  await t.test('expiry cannot release linked Stripe or an in-flight PayPal capture', async () => {
    const stripe = order('stripe')
    const paypal = order('paypal')
    await reserve(stripe, 'STRIPE-EXPIRY', 1000)
    await reserve(paypal, 'PAYPAL-CLAIM', 1000)
    await db.query("update shop_orders set provider_order_id='provider-stripe' where id=$1", [stripe.id])
    const claim = async id => (await db.query('select shop_claim_voucher_capture($1) as claimed', [id])).rows[0].claimed
    assert.equal(await claim(paypal.id), true)
    for (const [current, code] of [[stripe, 'STRIPE-EXPIRY'], [paypal, 'PAYPAL-CLAIM']]) {
      await backdate(current.id)
      await release(current.id, false)
      await assert.rejects(price(code), /voucher_unavailable/)
      await release(current.id, true)
      assert.equal(await price(code), 1000)
    }
    assert.equal(await claim(paypal.id), false)
  })
})
