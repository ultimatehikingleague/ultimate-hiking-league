import test from 'node:test'
import assert from 'node:assert/strict'
process.env.NEXT_PUBLIC_SUPABASE_URL='https://database.example.com'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test-anon'
process.env.SUPABASE_SERVICE_ROLE_KEY='test-service'
const {calculateMetrics,getAdminMetrics}=await import('../app/lib/shop/admin-metrics')
const {GET}=await import('../app/api/admin/shop/metrics/route')
const unit = (shipping_status = 'in_transit', delivery_status = 'unknown', quantity = 1) => ({
 mode: 'live', production_status: 'unknown', shipping_status, delivery_status,
 shop_fulfillment_unit_lines: [{order_line_id:'line',quantity}],
})
const payment = (id:string,status='paid',mode='live',paid_at='2026-11-05T23:00:00+00:00',
 units = [unit()], transfer: string | null = 'submitted') => ({
 order_id:id,mode,amount_cents:3564,currency:'EUR',
 shop_orders:{mode,status,paid_at,total_cents:3564,shop_fulfillment:transfer?{status:transfer}:null,
  shop_order_lines:[{id:'line',quantity:1}],shop_fulfillment_units:units},
})
test('confirmed live totals exclude pending, refunded and test records; only proven open orders count',()=>{
 const m=calculateMetrics([
  payment('a'),payment('b','paid','live','2026-11-06T23:00:00Z',[unit('unknown','delivered')]),
  payment('c','pending'),payment('d','refunded'),payment('e','paid','test'),
  payment('f','paid','live','2026-11-06T11:00:00Z',[],'pending'),
 ],new Date('2026-11-06T12:00:00Z'))
 assert.equal(m.paidToday,2);assert.equal(m.revenueCents,10692)
 assert.equal(m.knownOpen,2);assert.equal(m.openOrders,2);assert.equal(m.refundedRecords,1)
 assert.throws(()=>calculateMetrics([payment('a'),payment('a')]))
})
test('submitted alone and incompletely mapped deliveries leave the total unknown',()=>{
 const m=calculateMetrics([
  payment('open'), payment('unknown','paid','live','2026-11-06T11:00:00Z',[]),
  payment('partial','paid','live','2026-11-06T11:00:00Z',[unit('unknown','delivered',2)]),
 ])
 assert.equal(m.openOrders,null);assert.equal(m.knownOpen,1);assert.equal(m.unknownFulfillment,2)
 assert.equal(calculateMetrics([payment('closed','paid','live','2026-11-06T11:00:00Z',[unit('unknown','delivered')])]).openOrders,0)
})
test('Berlin day spans summer time transition correctly',()=>{
 const rows=[payment('a','paid','live','2026-03-28T23:00:00Z'),payment('b','paid','live','2026-03-29T21:59:59Z'),payment('c','paid','live','2026-03-29T22:00:00Z')]
 assert.equal(calculateMetrics(rows,new Date('2026-03-29T10:00:00Z')).paidToday,2)
})
test('metrics require server admin and paginate all data using GET only',async()=>{
 const original=globalThis.fetch;let admin=false,queries=0
 globalThis.fetch=async(input,init)=>{
 const req=input instanceof Request?input:null,url=new URL(req?.url||String(input));assert.equal(init?.method||req?.method||'GET','GET')
 if(url.pathname==='/auth/v1/user')return Response.json({id:'admin-user',aud:'authenticated'})
 if(url.pathname.endsWith('/admin_users'))return Response.json(admin?{user_id:'admin-user'}:null)
 if(url.pathname.endsWith('/shop_payments')){assert.equal(url.searchParams.get('mode'),'eq.live');assert.equal(url.searchParams.get('shop_orders.status'),'in.(paid,refunded)');queries++;return Response.json(queries===1?Array.from({length:500},(_,i)=>payment(String(i))):[payment('501')])}
 throw Error('Unexpected request')
 }
 try{
 assert.equal((await GET(new Request('https://shop.example.com/api/admin/shop/metrics'))).status,403)
 const req=new Request('https://shop.example.com/api/admin/shop/metrics',{headers:{Authorization:'Bearer token'}})
 assert.equal((await GET(req)).status,403);assert.equal(queries,0);admin=true
 const res=await GET(req);assert.equal(res.status,200);assert.match(res.headers.get('cache-control')!,/no-store/);assert.equal((await res.json()).revenueCents,501*3564);assert.equal(queries,2)
 // A read error must never be shown as zero revenue.
 globalThis.fetch=async()=>new Response('',{status:500});await assert.rejects(getAdminMetrics())
 }finally{globalThis.fetch=original}
})
