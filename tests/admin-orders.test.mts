import test from 'node:test'
import assert from 'node:assert/strict'
process.env.NEXT_PUBLIC_SUPABASE_URL='https://database.example.com'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test-anon'
process.env.SUPABASE_SERVICE_ROLE_KEY='test-service'
const {orderFilters,berlinBoundary}=await import('../app/lib/shop/admin-orders')
const {GET}=await import('../app/api/admin/shop/orders/route')
test('filters validate inputs and include entire Berlin day, including daylight saving boundaries',()=>{
 assert.equal(orderFilters(new URLSearchParams()).status,'paid')
 assert.equal(berlinBoundary('2026-11-06'),'2026-11-05T23:00:00.000Z')
 assert.equal(berlinBoundary('2026-07-06'),'2026-07-05T22:00:00.000Z')
 assert.equal(berlinBoundary('2026-03-29',true),'2026-03-29T22:00:00.000Z')
 assert.throws(()=>orderFilters(new URLSearchParams('status=shipped')))
 assert.throws(()=>orderFilters(new URLSearchParams('page=0')))
 assert.throws(()=>orderFilters(new URLSearchParams('from=2026-02-30')))
 assert.throws(()=>orderFilters(new URLSearchParams('from=2026-11-07&to=2026-11-06')))
})
test('admin API refuses missing token and non-admin; authorised reads never issue mutations',async()=>{
 const original=globalThis.fetch;const calls:{url:URL;method:string}[]=[];let admin=false
 globalThis.fetch=async(input,init)=>{
 const request=input instanceof Request?input:null,url=new URL(request?.url||String(input)),method=init?.method||request?.method||'GET';calls.push({url,method})
 if(url.pathname==='/auth/v1/user')return Response.json({id:'admin-user',aud:'authenticated'})
 if(url.pathname.endsWith('/admin_users'))return Response.json(admin?{user_id:'admin-user'}:null)
 if(url.pathname.endsWith('/shop_orders'))return Response.json([{id:'id',address:{firstName:'Test',lastName:'Kunde'},mode:'test'}],{headers:{'content-range':'0-0/1'}})
 throw Error('Unexpected request')
 }
 try{
 assert.equal((await GET(new Request('https://shop.example.com/api/admin/shop/orders'))).status,403)
 assert.equal(calls.length,0)
 const request=()=>new Request('https://shop.example.com/api/admin/shop/orders?mode=live&status=paid&from=2026-11-06&to=2026-11-06',{headers:{Authorization:'Bearer token'}})
 assert.equal((await GET(request())).status,403)
 assert.equal(calls.some(c=>c.url.pathname.endsWith('/shop_orders')),false)
 admin=true
 const response=await GET(request());assert.equal(response.status,200);assert.match(response.headers.get('cache-control')!,/no-store/)
 const data=await response.json();assert.equal(data.orders[0].customer,'Test Kunde');assert.equal('address' in data.orders[0],false)
 const query=calls.find(c=>c.url.pathname.endsWith('/shop_orders'))!.url.searchParams
 assert.match(query.get('select')!,/shop_payments!inner/);assert.equal(query.get('mode'),'eq.live');assert.equal(query.get('status'),'eq.paid');assert.equal(query.getAll('created_at').length,2)
 assert.equal(calls.every(c=>c.method==='GET'),true)
 }finally{globalThis.fetch=original}
})
test('detail joins and invoice download only read stored records after authorisation',async()=>{
 const original=globalThis.fetch;const calls:string[]=[];const id='39933fa1-bce3-49ef-8956-46f48f54f234'
 globalThis.fetch=async(input,init)=>{
 const req=input instanceof Request?input:null,url=new URL(req?.url||String(input));assert.equal(init?.method||req?.method||'GET','GET');calls.push(url.pathname)
 if(url.pathname==='/auth/v1/user')return Response.json({id:'admin-user',aud:'authenticated'})
 if(url.pathname.endsWith('/admin_users'))return Response.json({user_id:'admin-user'})
 if(url.pathname.endsWith('/shop_orders'))return Response.json({id,status:'paid'})
 if(url.pathname.endsWith('/shop_invoices')&&url.searchParams.get('select')?.includes('pdf_base64'))return Response.json({number:'UHL-2026-000001',pdf_base64:Buffer.from('%PDF-original').toString('base64')})
 return Response.json([])
 }
 try{
 const request=(tail:string)=>new Request('https://shop.example.com/api/admin/shop/orders?id='+id+tail,{headers:{Authorization:'Bearer token'}})
 const detail=await (await GET(request(''))).json();assert.equal(detail.order.id,id);assert.deepEqual(detail.fulfillments,[])
 for(const table of ['shop_orders','shop_payments','shop_order_lines','shop_fulfillment','shop_invoices'])assert.ok(calls.includes('/rest/v1/'+table))
 const pdf=await GET(request('&invoice=1'));assert.equal(await pdf.text(),'%PDF-original');assert.equal(pdf.headers.get('content-type'),'application/pdf')
 assert.equal(calls.some(p=>p.includes('/rpc/')),false)
 }finally{globalThis.fetch=original}
})
