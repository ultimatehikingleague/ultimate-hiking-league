import test from 'node:test'
import assert from 'node:assert/strict'
import { transferTestDraft } from '../app/lib/shop/fulfillment'
import { CALENDAR } from '../app/lib/shop/config'
import type { ShopOrder } from '../app/lib/shop/orders'
const order = { id: 'd0ad9bf1-213c-444b-984a-8df44048be5e', mode: 'test', status: 'paid', currency: 'EUR', product_uid: CALENDAR.productUid, file_url: CALENDAR.fileUrl, file_sha256: CALENDAR.fileSha256, page_count: 14, quantity: 1, shipping_method_uid: 'dhl_parcel', address: { firstName: 'Test', lastName: 'Kunde', addressLine1: 'Testweg 1', addressLine2: '', city: 'Berlin', postCode: '10115', country: 'DE', email: 'test@example.com', phone: '' } } as ShopOrder
process.env.GELATO_API_KEY = 'fake-test-key'
test('existing Gelato draft is reused; no duplicate create request', async () => {
 const original=globalThis.fetch; const requests:string[]=[]
 globalThis.fetch=async url=>{requests.push(String(url));return Response.json(String(url).endsWith('orders:search')?{orders:[{id:'existing',orderReferenceId:`ultimate-test-${order.id}`}]}:{id:'existing',orderType:'draft',orderReferenceId:`ultimate-test-${order.id}`})}
 try {assert.equal(await transferTestDraft(order),'existing');assert.equal(requests.length,2);assert.equal(requests[1].endsWith('/orders/existing'),true)} finally {globalThis.fetch=original}
})
test('create is draft only and an ambiguous create failure is never retried', async()=>{
 const original=globalThis.fetch;let creates=0
 globalThis.fetch=async(url,options)=>{if(String(url).endsWith('orders:search'))return Response.json({orders:[]});creates++;const body=JSON.parse(options!.body as string);assert.equal(body.orderType,'draft');throw new Error('Connection interrupted')}
 try{await assert.rejects(transferTestDraft(order));assert.equal(creates,1);await assert.rejects(transferTestDraft({...order,mode:'live'}));assert.equal(creates,1)}finally{globalThis.fetch=original}
})

test('live production requires both approval flags, a paid live order and the approved print snapshot', async()=>{
 const {buildLiveOrder}=await import('../app/lib/shop/gelato-draft')
 const approved=process.env.SHOP_LIVE_APPROVED,enabled=process.env.SHOP_FULFILLMENT_ENABLED
 try{
 process.env.SHOP_LIVE_APPROVED='false';process.env.SHOP_FULFILLMENT_ENABLED='true'
 assert.throws(()=>buildLiveOrder({...order,mode:'live'}))
 process.env.SHOP_LIVE_APPROVED='true';process.env.SHOP_FULFILLMENT_ENABLED='false'
 assert.throws(()=>buildLiveOrder({...order,mode:'live'}))
 process.env.SHOP_FULFILLMENT_ENABLED='true'
 assert.throws(()=>buildLiveOrder(order));assert.throws(()=>buildLiveOrder({...order,mode:'live',status:'pending'}))
 assert.throws(()=>buildLiveOrder({...order,mode:'live',file_sha256:'wrong'}))
 const payload=buildLiveOrder({...order,mode:'live'})
 assert.equal(payload.orderType,'order');assert.equal(payload.orderReferenceId,`ultimate-live-${order.id}`)
 }finally{if(approved===undefined)delete process.env.SHOP_LIVE_APPROVED;else process.env.SHOP_LIVE_APPROVED=approved;if(enabled===undefined)delete process.env.SHOP_FULFILLMENT_ENABLED;else process.env.SHOP_FULFILLMENT_ENABLED=enabled}
})
