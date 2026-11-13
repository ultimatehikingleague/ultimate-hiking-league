import { requireShopAdmin } from '../../../../lib/requireShopAdmin'
import { listAdminOrders, adminOrderDetail, OrderFilterError } from '../../../../lib/shop/admin-orders'
import { orderDB } from '../../../../lib/shop/orders'
export const runtime='nodejs'
export const dynamic='force-dynamic'
const headers={'Cache-Control':'private, no-store','Vary':'Authorization','X-Content-Type-Options':'nosniff'}
export async function GET(request:Request){
 try{
 if(!await requireShopAdmin(request))return Response.json({error:'Zugriff verweigert.'},{status:403,headers})
 const params=new URL(request.url).searchParams,id=params.get('id')
 if(id){
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))return Response.json({error:'Ungültige Bestellnummer.'},{status:400,headers})
 if(params.get('invoice')==='1'){
 // Read the issued original only. Never invoke invoiceForOrder (which can create an invoice).
 const {data,error}=await orderDB().from('shop_invoices').select('number,pdf_base64').eq('order_id',id).maybeSingle()
 if(error)throw Error('Invoice unavailable')
 if(!data?.pdf_base64)return Response.json({error:'Keine gespeicherte Rechnung vorhanden.'},{status:404,headers})
 const filename=data.number.replace(/[^A-Za-z0-9_-]/g,'')
 return new Response(Buffer.from(data.pdf_base64,'base64'),{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${filename}.pdf"`}})
 }
 const detail=await adminOrderDetail(id)
 return Response.json(detail||{error:'Bestellung nicht gefunden.'},{status:detail?200:404,headers})
 }
 return Response.json(await listAdminOrders(params),{headers})
 }catch(error){return Response.json({error:error instanceof OrderFilterError?error.message:'Daten konnten nicht geladen werden.'},{status:error instanceof OrderFilterError?400:503,headers})}
}
