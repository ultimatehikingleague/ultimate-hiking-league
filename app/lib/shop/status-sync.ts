import { createHash } from 'node:crypto'
import { orderDB } from './orders'
import { readGelatoStatus, statusSnapshot } from './gelato-status'

export async function processStatusSync(limit=3, orderId?:string){
 const db=orderDB()
 let processed=0
 for(let n=0;n<Math.min(limit,5);n++){
 const claimed=await db.rpc('shop_tracking_claim',orderId?{p_order_id:orderId}:{})
 if(claimed.error)throw Error('TRACKING_CLAIM_FAILED')
 const job=claimed.data?.[0];if(!job)break
 try{
 const {data:u,error}=await db.from('shop_fulfillment_units').select('id,order_id,mode,provider,external_order_id,external_reference').eq('id',job.unit_id).single()
 if(error||!u||u.provider!=='gelato'||u.mode!=='live'||u.external_reference!==`ultimate-${u.mode}-${u.order_id}`)throw Error('GELATO_REFERENCE_MISMATCH')
 const deadline=Date.now()+80000
 const data=await readGelatoStatus(u.external_order_id,u.external_reference,u.mode)
 const snapshot=statusSnapshot(data)
 // Discover split orders without ever invoking Gelato create/search/cancel APIs.
 const connected=[...new Set(data.connectedOrderIds||[])].filter(id=>id!==u.external_order_id)
 if(connected.length){
 const {data:linked,error:linkError}=await db.from('shop_fulfillment_units').select('external_order_id')
  .eq('order_id',u.order_id).eq('provider','gelato').eq('mode',u.mode).in('external_order_id',connected)
 if(linkError)throw Error('CONNECTED_ORDER_LOOKUP_FAILED')
 const known=new Set(linked.map(row=>row.external_order_id))
 for(const id of connected){
 if(known.has(id))continue
 if(Date.now()>deadline-15000)throw Error('CONNECTED_ORDER_TIMEOUT')
 await readGelatoStatus(id,u.external_reference,u.mode) // validate ownership before storage
 const result=await db.rpc('shop_tracking_link',{p_unit_id:u.id,p_token:job.claim_token,p_external_id:id})
 if(result.error)throw Error('CONNECTED_ORDER_STORAGE_FAILED')
 }
 }
 const applied=await db.rpc('shop_tracking_apply',{p_unit_id:u.id,p_token:job.claim_token,p_snapshot:snapshot,p_hash:createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')})
 if(applied.error||!applied.data)throw Error('TRACKING_APPLY_FAILED')
 processed++
 }catch(e){
 // Only bounded technical codes, never persist API response bodies or credentials.
 const message=e instanceof Error?e.message:''
 const code=/^[A-Z][A-Z0-9_]{1,79}$/.test(message)?message:'STATUS_SYNC_FAILED'
 const failure=await db.rpc('shop_tracking_apply',{p_unit_id:job.unit_id,p_token:job.claim_token,p_snapshot:null,p_hash:job.claim_token,p_error:code})
 if(failure.error)throw Error('TRACKING_ERROR_STORAGE_FAILED')
 }
 }
 return {processed}
}
export async function adminTracking(orderId:string){
 const {data,error}=await orderDB().from('shop_fulfillment_units').select('id,provider,mode,external_order_id,raw_status,production_status,shipping_status,delivery_status,last_success_at,review_reason,shop_fulfillment_shipments(id,external_package_id,shipping_method_name,carrier,tracking_number,tracking_url,shipped_at,delivered_at,last_success_at),shop_fulfillment_sync(state,last_attempt_at,last_success_at,last_error_code,last_error,next_attempt_at)').eq('order_id',orderId).order('created_at')
 if(error){if(['42P01','PGRST205','PGRST200'].includes(error.code))return {units:[],available:false};throw Error('TRACKING_READ_FAILED')}
 return {units:data||[],available:true}
}
