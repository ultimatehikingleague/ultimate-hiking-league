import { NextRequest, NextResponse } from 'next/server'
import { getOrder } from '../../../lib/shop/orders'
import { validAccess, orderCookie } from '../../../lib/shop/tokens'
import { invoiceForOrder } from '../../../lib/shop/invoices'
import { CheckoutError } from '../../../lib/shop/validation'
import { errorResponse } from '../../../lib/shop/http'
export const runtime='nodejs'
export async function GET(request:NextRequest){
 try{
 const id=new URL(request.url).searchParams.get('order')
 if(!id||!/^[a-f0-9-]{36}$/.test(id))throw new CheckoutError('Bestellung nicht gefunden.',404)
 const order=await getOrder(id)
 if(!order||!validAccess(request.cookies.get(orderCookie(id))?.value,order.access_token_hash))throw new CheckoutError('Bestellung nicht gefunden.',404)
 if(order.status!=='paid')throw new CheckoutError('Die Rechnung ist nach bestätigter Zahlung verfügbar.',409)
 const {invoice,pdf}=await invoiceForOrder(order)
 return new NextResponse(new Uint8Array(pdf),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="Rechnung-${invoice.number}.pdf"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
 }catch(e){return errorResponse(e)}
}
