import test from 'node:test'
import assert from 'node:assert/strict'
import { readGelatoStatus, statusSnapshot, statusProjection } from '../app/lib/shop/gelato-status'
import { safeTrackingUrl } from '../app/lib/shop/tracking-url'
process.env.NEXT_PUBLIC_SUPABASE_URL='https://db.example.com'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='anon'
process.env.SUPABASE_SERVICE_ROLE_KEY='service'
process.env.GELATO_API_KEY='test-key'
const {GET,POST}=await import('../app/api/admin/shop/tracking/route')
const {GET:cron}=await import('../app/api/shop/status-jobs/route')
const {processStatusSync}=await import('../app/lib/shop/status-sync')
const fixture={id:'external',orderType:'order',orderReferenceId:'ultimate-live-local',fulfillmentStatus:'in_production',items:[{id:'item',productUid:'calendar',quantity:1}],shipment:{id:'shipment',shipmentMethodName:'Example method',packages:[{id:'parcel',orderItemIds:['item'],trackingCode:'tracking',trackingUrl:'https://carrier.example/track'}]}}
test('tracking before dispatch does not imply shipped; unknown statuses and timestamps remain unknown',()=>{
 const snapshot=statusSnapshot(fixture)
 assert.equal(snapshot.production_status,'in_production');assert.equal(snapshot.shipping_status,'unknown');assert.equal(snapshot.packages[0].tracking_number,'tracking');assert.equal('shipped_at' in snapshot.packages[0],false)
 assert.equal(statusProjection('printed').shipping_status,'unknown')
 assert.equal(statusProjection('delivered').delivery_status,'delivered')
 assert.equal(statusProjection('new-status').production_status,'unknown')
 assert.equal(safeTrackingUrl('javascript:alert(1)'),null);assert.equal(safeTrackingUrl('https://user:secret@carrier.example'),null)
 assert.equal(safeTrackingUrl('https://carrier.example/track'),'https://carrier.example/track')
 assert.equal(JSON.stringify(snapshot).includes('financialStatus'),false)
})
test('Gelato client only GETs and rejects cross-order and cross-mode results',async()=>{
 const original=globalThis.fetch;let body=fixture
 globalThis.fetch=async(input,init)=>{assert.equal(init?.method,'GET');assert.equal(String(input),'https://order.gelatoapis.com/v4/orders/external');return Response.json(body)}
 try{await readGelatoStatus('external','ultimate-live-local','live');await assert.rejects(readGelatoStatus('external','other','live'),/MISMATCH/);await assert.rejects(readGelatoStatus('external','ultimate-live-local','test'),/MISMATCH/);body={...fixture,orderType:'draft'};await readGelatoStatus('external','ultimate-live-local','test')}finally{globalThis.fetch=original}
})
test('admin endpoints deny unauthorised requests before DB and reject cross-origin refresh',async()=>{
 const original=globalThis.fetch;let calls=0
 globalThis.fetch=async(input)=>{calls++;const url=new URL(input instanceof Request?input.url:String(input));if(url.pathname==='/auth/v1/user')return Response.json({id:'admin',aud:'authenticated'});if(url.pathname.endsWith('/admin_users'))return Response.json({user_id:'admin'});throw Error('Unexpected database mutation')}
 try{assert.equal((await GET(new Request('https://shop.example/api/admin/shop/tracking'))).status,403);assert.equal((await POST(new Request('https://shop.example/api/admin/shop/tracking',{method:'POST'}))).status,403);assert.equal(calls,0);assert.equal((await POST(new Request('https://shop.example/api/admin/shop/tracking',{method:'POST',headers:{Authorization:'Bearer test',Origin:'https://other.example'}}))).status,403);assert.equal(calls,2)}finally{globalThis.fetch=original}
})
test('status cron requires its secret and is disabled unless explicitly enabled',async()=>{
 process.env.CRON_SECRET='cron-test';delete process.env.SHOP_STATUS_SYNC_ENABLED
 assert.equal((await cron(new Request('https://shop.example/api/shop/status-jobs'))).status,401)
 const response=await cron(new Request('https://shop.example/api/shop/status-jobs',{headers:{Authorization:'Bearer cron-test'}}));assert.deepEqual(await response.json(),{enabled:false})
})
test('worker never creates Gelato orders; validates split ownership and persists errors safely',async()=>{
 const original=globalThis.fetch;const methods:string[]=[];let claim=0;let saved:Record<string,unknown>|undefined
 globalThis.fetch=async(input,init)=>{
 const r=input instanceof Request?input:null,url=new URL(r?.url||String(input)),method=init?.method||r?.method||'GET';methods.push(url.hostname+':'+method+':'+url.pathname)
 if(url.hostname==='order.gelatoapis.com'){assert.equal(method,'GET');return Response.json({...fixture,connectedOrderIds:['foreign']})}
 if(url.pathname.endsWith('/shop_tracking_claim'))return Response.json(claim++?[]:[{unit_id:'unit',claim_token:'token'}])
 if(url.pathname.endsWith('/shop_fulfillment_units'))return Response.json(url.searchParams.has('external_order_id')?[]:{id:'unit',order_id:'local',mode:'live',provider:'gelato',external_order_id:'external',external_reference:'ultimate-live-local'})
 if(url.pathname.endsWith('/shop_tracking_apply')){saved=JSON.parse(init?.body as string||await r!.text());return Response.json(true)}
 throw Error('Unexpected request '+url.pathname)
 }
 try{await processStatusSync();assert.equal(saved?.p_error,'GELATO_REFERENCE_MISMATCH');assert.equal(saved?.p_snapshot,null);assert.equal(methods.filter(s=>s.startsWith('order.gelatoapis.com')).every(s=>s.includes(':GET:')),true)}finally{globalThis.fetch=original}
})
test('successful worker uses only tracking storage and preserves separate status facts',async()=>{
 const original=globalThis.fetch;let claims=0;let applied:Record<string,unknown>|undefined
 globalThis.fetch=async(input,init)=>{
 const r=input instanceof Request?input:null,url=new URL(r?.url||String(input)),method=init?.method||r?.method||'GET'
 if(url.hostname==='order.gelatoapis.com'){assert.equal(method,'GET');return Response.json(fixture)}
 if(url.pathname.endsWith('/shop_tracking_claim'))return Response.json(claims++?[]:[{unit_id:'unit',claim_token:'token'}])
 if(url.pathname.endsWith('/shop_fulfillment_units')){assert.equal(method,'GET');return Response.json({id:'unit',order_id:'local',mode:'live',provider:'gelato',external_order_id:'external',external_reference:'ultimate-live-local'})}
 if(url.pathname.endsWith('/shop_tracking_apply')){applied=JSON.parse(init?.body as string||await r!.text());return Response.json(true)}
 throw Error('Unexpected write or request '+url.pathname)
 }
 try{assert.deepEqual(await processStatusSync(),{processed:1});const snap=applied?.p_snapshot as {shipping_status:string};assert.equal(snap.shipping_status,'unknown');assert.equal(applied?.p_error,undefined);assert.equal(typeof applied?.p_hash,'string')}finally{globalThis.fetch=original}
})

test('idle cron worker makes one database claim and zero Gelato requests',async()=>{
 const original=globalThis.fetch
 let calls=0
 globalThis.fetch=async(input)=>{
  const url=new URL(input instanceof Request?input.url:String(input))
  assert.equal(url.pathname,'/rest/v1/rpc/shop_tracking_claim')
  calls++
  return Response.json([])
 }
 try{assert.deepEqual(await processStatusSync(),{processed:0});assert.equal(calls,1)}finally{globalThis.fetch=original}
})
