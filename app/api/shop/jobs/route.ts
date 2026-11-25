import { reconcileExpiredVoucherOrders } from '../../../lib/shop/voucher-expiry'
import { processCustomerNotifications } from '../../../lib/shop/confirmations'
import { timingSafeEqual } from 'node:crypto'
import { processNextHostedFulfillment } from '../../../lib/shop/fulfillment'
export const runtime='nodejs'
export const maxDuration=300
export async function GET(request:Request){
 const expected=process.env.CRON_SECRET
 const supplied=request.headers.get('authorization')||''
 const target=`Bearer ${expected||''}`
 if(!expected||Buffer.byteLength(supplied)!==Buffer.byteLength(target)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(target)))return new Response('Unauthorized',{status:401})
 try{
 let vouchersOk=false
 try{vouchersOk=await reconcileExpiredVoucherOrders()}catch{console.error('Voucher reconciliation needs review')}
 let notificationsOk=true
 try{await processCustomerNotifications()}catch{notificationsOk=false;console.error('Customer notifications need review')}
 const processed=[]
 for(let i=0;i<2;i++){const result=await processNextHostedFulfillment();if(!result)break;processed.push(result)}
 return Response.json({processed,notificationsOk,vouchersOk},{headers:{'Cache-Control':'no-store'}})
 }catch{return new Response('Worker unavailable',{status:503})}
}
