import { requireShopAdmin } from '../../../../lib/requireShopAdmin'
import { adminTracking, processStatusSync } from '../../../../lib/shop/status-sync'
import { orderDB } from '../../../../lib/shop/orders'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=300
const headers={'Cache-Control':'private, no-store','Vary':'Authorization'}
const valid=(id:string|null)=>!!id&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)
export async function GET(request:Request){
 try{
 if(!await requireShopAdmin(request))return Response.json({error:'Zugriff verweigert.'},{status:403,headers})
 const id=new URL(request.url).searchParams.get('id');if(!valid(id))return Response.json({error:'Ungültige Bestellnummer.'},{status:400,headers})
 return Response.json(await adminTracking(id!),{headers})
 }catch{return Response.json({error:'Statusdaten nicht verfügbar.'},{status:503,headers})}
}
export async function POST(request:Request){
 try{
 if(!await requireShopAdmin(request))return Response.json({error:'Zugriff verweigert.'},{status:403,headers})
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Aufruf nicht zulässig.'},{status:403,headers})
 if(process.env.SHOP_STATUS_SYNC_ENABLED!=='true')return Response.json({error:'Statusabgleich noch nicht aktiviert.'},{status:503,headers})
 const id=new URL(request.url).searchParams.get('id');if(!valid(id))return Response.json({error:'Ungültige Bestellnummer.'},{status:400,headers})
 const result=await orderDB().rpc('shop_tracking_refresh',{p_order_id:id})
 if(result.error)throw Error('QUEUE_FAILED')
 if(!result.data)return Response.json({message:'Kein Abgleich verfügbar oder bereits kürzlich ausgeführt.'},{status:202,headers})
 const run=await processStatusSync(3,id!)
 return Response.json({message:run.processed?`Aktualisierte Anbieteraufträge: ${run.processed}.`:'Statusabgleich übernommen. Prüfe den gespeicherten Stand.'},{status:202,headers})
 }catch{return Response.json({error:'Abgleich konnte nicht vorgemerkt werden.'},{status:503,headers})}
}
