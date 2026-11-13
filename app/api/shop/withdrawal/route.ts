import { after } from 'next/server'
import { assertSameOrigin } from '../../../lib/shop/config'
import { jsonBody,rateLimit,errorResponse } from '../../../lib/shop/http'
import { CheckoutError } from '../../../lib/shop/validation'
import { orderDB } from '../../../lib/shop/orders'
import { sendWithdrawalReceipt } from '../../../lib/shop/confirmations'
export const runtime='nodejs'
export async function POST(request:Request){try{
 assertSameOrigin(request);await rateLimit(request,'withdrawal')
 const b=await jsonBody(request)
 if(!/^[a-f0-9-]{36}$/.test(b.id||''))throw new CheckoutError('Ungültige Anfrage.')
 for(const [key,max]of [['name',120],['email',254],['contractReference',2000]] as const)if(typeof b[key]!=='string'||!b[key].trim()||b[key].length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(b[key]))throw new CheckoutError('Bitte Angaben vollständig prüfen.')
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email))throw new CheckoutError('Bitte E-Mail-Adresse prüfen.')
 const db=orderDB();const row={id:b.id,name:b.name.trim(),email:b.email.trim(),contract_reference:b.contractReference.trim()}
 const insert=await db.from('shop_withdrawals').insert(row)
 if(insert.error&&insert.error.code!=='23505')throw Error('Withdrawal persistence failed')
 const result=await db.from('shop_withdrawals').select('*').eq('id',row.id).single()
 if(result.error||!result.data||result.data.email!==row.email||result.data.name!==row.name||result.data.contract_reference!==row.contract_reference)throw new CheckoutError('Bitte die Seite neu laden und erneut versuchen.',409)
 const entry=result.data
 if(!entry.confirmation_sent_at)after(async()=>{try{await sendWithdrawalReceipt(entry)}catch{console.error('Withdrawal receipt needs retry')}})
 return Response.json({id:entry.id,receivedAt:entry.received_at},{headers:{'Cache-Control':'no-store'}})
 }catch(e){return errorResponse(e)}}
