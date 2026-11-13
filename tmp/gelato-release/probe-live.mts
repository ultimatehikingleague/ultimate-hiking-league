import fs from 'node:fs'
import { parseEnv } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import { readGelatoStatus, statusSnapshot } from '../../app/lib/shop/gelato-status'
const env=parseEnv(fs.readFileSync('.env.local','utf8'))
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.GELATO_API_KEY) throw Error('Missing runtime configuration')
process.env.GELATO_API_KEY=env.GELATO_API_KEY
const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
const counts:Record<string,number|null>={}
for(const table of ['shop_orders','shop_payments','shop_invoices','shop_fulfillment']){
 const {count,error}=await db.from(table).select('*',{head:true,count:'exact'})
 if(error)throw Error('Count unavailable: '+table+' '+error.code)
 counts[table]=count
}
const {error:trackingError}=await db.from('shop_fulfillment_units').select('id').limit(1)
const {data,error}=await db.from('shop_fulfillment').select('order_id,gelato_order_id')
 .eq('mode','live').eq('status','submitted').not('gelato_order_id','is',null).order('completed_at',{ascending:false}).limit(2)
if(error)throw Error('Fulfillment lookup '+error.code)
if(data.length!==1)throw Error('Expected one submitted LIVE order; found '+data.length)
const [row]=data
const remote=await readGelatoStatus(row.gelato_order_id,'ultimate-live-'+row.order_id,'live')
const snapshot=statusSnapshot(remote)
const result={capturedAt:new Date().toISOString(),counts,trackingSchema:trackingError?.code??'present',
 currentLive:{status:snapshot.raw_status,production:snapshot.production_status,shipping:snapshot.shipping_status,delivery:snapshot.delivery_status,packages:snapshot.packages.length,trackingPresent:snapshot.packages.some(p=>!!p.tracking_number||!!p.tracking_url),connectedOrders:remote.connectedOrderIds?.length??0}}
console.log(JSON.stringify(result))
fs.writeFileSync('tmp/gelato-release/live-baseline.json',JSON.stringify(result,null,2)+'\n')
