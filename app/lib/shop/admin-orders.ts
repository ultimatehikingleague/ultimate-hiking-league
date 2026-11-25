import { orderDB, type ShopOrder } from './orders'

export class OrderFilterError extends Error {}
export function berlinBoundary(value: string, nextDay = false) {
 if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) throw new OrderFilterError('Ungültiges Datum.')
 const date = new Date(value+'T00:00:00Z')
 if(nextDay) date.setUTCDate(date.getUTCDate()+1)
 const zone = new Intl.DateTimeFormat('en',{timeZone:'Europe/Berlin',timeZoneName:'shortOffset'}).formatToParts(date).find(p=>p.type==='timeZoneName')!.value
 const hours = Number(zone.replace('GMT',''))
 return new Date(date.getTime()-hours*3600000).toISOString()
}
export function orderFilters(params: URLSearchParams) {
 const status=params.get('status')||'paid', mode=params.get('mode')||'all', from=params.get('from')||'', to=params.get('to')||''
 if(!['all','pending','paid','failed','refunded'].includes(status)||!['all','test','live'].includes(mode)) throw new OrderFilterError('Ungültiger Filter.')
 const start=from?berlinBoundary(from):null, end=to?berlinBoundary(to,true):null
 if(from&&to&&from>to)throw new OrderFilterError('Der Zeitraum ist ungültig.')
 const page=Number(params.get('page')||1)
 if(!Number.isSafeInteger(page)||page<1||page>100000)throw new OrderFilterError('Ungültige Seite.')
 return {status,mode,start,end,page}
}
export const orderColumns='id,created_at,paid_at,provider,mode,status,quantity,unit_price_cents,shipping_cents,total_cents,currency,address,sku,product_name,provider_order_id,voucher_code,discount_cents'
export async function listAdminOrders(params: URLSearchParams) {
 const f=orderFilters(params)
 let q=orderDB().from('shop_orders').select(f.status==='paid'?orderColumns+',shop_payments!inner(payment_id)':orderColumns,{count:'exact'}).order('created_at',{ascending:false}).order('id',{ascending:false})
 if(f.status!=='all')q=q.eq('status',f.status)
 if(f.mode!=='all')q=q.eq('mode',f.mode)
 if(f.start)q=q.gte('created_at',f.start)
 if(f.end)q=q.lt('created_at',f.end)
 const {data,error,count}=await q.range((f.page-1)*25,f.page*25-1)
 if(error)throw Error('Bestellungen konnten nicht geladen werden.')
 return {orders:((data||[]) as unknown as (ShopOrder & { shop_payments?: unknown })[]).map(row=>({...row,address:undefined,shop_payments:undefined,customer:[row.address?.firstName,row.address?.lastName].filter(Boolean).join(' ')})),total:count||0,page:f.page,pageSize:25}
}
// Keep positions and fulfillment separate: future shipments may span partners and positions.
export async function adminOrderDetail(id:string) {
 const db=orderDB()
 const results=await Promise.all([
 db.from('shop_orders').select(orderColumns).eq('id',id).maybeSingle(),
 db.from('shop_order_lines').select('id,line_number,sku,name,quantity,unit_price_cents,total_cents').eq('order_id',id).order('line_number'),
 db.from('shop_payments').select('provider,mode,payment_id,amount_cents,currency,created_at').eq('order_id',id),
 db.from('shop_fulfillment').select('mode,status,gelato_order_id,attempts,started_at,completed_at,last_error,created_at').eq('order_id',id),
 db.from('shop_invoices').select('number,issued_at,mode,confirmation_started_at,confirmation_sent_at').eq('order_id',id),
 ])
 if(results.some(r=>r.error))throw Error('Bestelldetails konnten nicht geladen werden.')
 if(!results[0].data)return null
 return {order:results[0].data,lines:results[1].data,payments:results[2].data,fulfillments:results[3].data,invoices:results[4].data}
}
