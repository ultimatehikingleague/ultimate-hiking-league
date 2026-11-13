import { timingSafeEqual } from 'node:crypto'
import { processStatusSync } from '../../../lib/shop/status-sync'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=300
export async function GET(request:Request){
 const target=`Bearer ${process.env.CRON_SECRET||''}`,supplied=request.headers.get('authorization')||''
 if(!process.env.CRON_SECRET||Buffer.byteLength(target)!==Buffer.byteLength(supplied)||!timingSafeEqual(Buffer.from(target),Buffer.from(supplied)))return new Response('Unauthorized',{status:401})
 if(process.env.SHOP_STATUS_SYNC_ENABLED!=='true')return Response.json({enabled:false},{headers:{'Cache-Control':'no-store'}})
 try{return Response.json(await processStatusSync(),{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'Statusabgleich nicht verfügbar.'},{status:503})}
}
