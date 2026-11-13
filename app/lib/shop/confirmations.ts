import { Resend } from 'resend'
import { required } from './config'
import { orderDB, type ShopOrder } from './orders'
import { invoiceForOrder } from './invoices'
import { confirmationText, renderConsumerInformation } from './confirmation-content'
const from='ULTIMATE Outdoor Store <welcome@mail.ultimatehikingleague.com>'
export async function sendOrderConfirmation(order:ShopOrder){
 if(order.mode!=='live'||process.env.SHOP_CONFIRMATIONS_ENABLED!=='true')return
 const db=orderDB(),{invoice,pdf}=await invoiceForOrder(order)
 const consumerInformation=await renderConsumerInformation(invoice)
 const claim=await db.from('shop_invoices').update({confirmation_started_at:new Date().toISOString()}).eq('order_id',order.id).is('confirmation_started_at',null).is('confirmation_sent_at',null).select('order_id')
 if(claim.error)throw Error('Confirmation queue unavailable')
 if(!claim.data?.length)return
 const result=await new Resend(required('RESEND_API_KEY')).emails.send({
  from, to:order.address.email, replyTo:'ultimatehikingleague@gmail.com',
  subject:`Bestellbestätigung · ULTIMATE Outdoor Store`,
  text:confirmationText(invoice),
  attachments:[
   {filename:`Rechnung-${invoice.number}.pdf`,content:pdf.toString("base64")},
   {filename:'Verbraucherinformationen.pdf',content:consumerInformation.toString("base64")},
  ],
 },{idempotencyKey:`order-confirmation-${order.id}`})
 if(result.error)throw Error('Confirmation send needs review')
 const saved=await db.from('shop_invoices').update({confirmation_sent_at:new Date().toISOString()}).eq('order_id',order.id)
 if(saved.error)throw Error('Confirmation status needs review')
}
export async function sendWithdrawalReceipt(entry:{id:string;name:string;email:string;contract_reference:string;received_at:string}){
 const text=`Eingangsbestätigung Ihres Widerrufs\n\nIhr Widerruf ist am ${new Date(entry.received_at).toLocaleString('de-DE',{timeZone:'Europe/Berlin'})} Uhr (Europe/Berlin) bei uns eingegangen.\nReferenz: ${entry.id}\nName: ${entry.name}\nE-Mail: ${entry.email}\nVertrag/Vertragsteil: ${entry.contract_reference}\nErklärung: Hiermit widerrufe ich den bezeichneten Vertrag/Vertragsteil.\n\nPhilipp Dobrinski / ULTIMATE\nAnsbacher Straße 4a\n91452 Wilhermsdorf\nDeutschland\nultimatehikingleague@gmail.com`
 const result=await new Resend(required('RESEND_API_KEY')).emails.send({from,to:entry.email,replyTo:'ultimatehikingleague@gmail.com',subject:'Eingangsbestätigung deines Widerrufs bei ULTIMATE',text},{idempotencyKey:`withdrawal-${entry.id}`})
 if(result.error)throw Error('Withdrawal receipt delivery failed')
 const saved=await orderDB().from('shop_withdrawals').update({confirmation_sent_at:new Date().toISOString()}).eq('id',entry.id)
 if(saved.error)throw Error('Withdrawal receipt status not persisted')
}

export async function processCustomerNotifications(){
 const db=orderDB()
 if(process.env.SHOP_CONFIRMATIONS_ENABLED==='true'){
  // Find paid live orders without an invoice, then unfinished existing invoices.
  const fresh=await db.from('shop_orders').select('*, shop_invoices(order_id)').eq('mode','live').eq('status','paid').is('shop_invoices',null).limit(10)
  if(fresh.error)throw Error('Confirmation lookup failed')
  for(const order of fresh.data||[])await sendOrderConfirmation(order as ShopOrder)
  const pending=await db.from('shop_invoices').select('order_id').eq('mode','live').is('confirmation_started_at',null).is('confirmation_sent_at',null).limit(10)
  if(pending.error)throw Error('Confirmation lookup failed')
  for(const invoice of pending.data||[]){const result=await db.from('shop_orders').select('*').eq('id',invoice.order_id).single();if(result.error)throw Error('Order unavailable');await sendOrderConfirmation(result.data as ShopOrder)}
 }
 const withdrawals=await db.from('shop_withdrawals').select('*').is('confirmation_sent_at',null).gte('received_at',new Date(Date.now()-23*60*60*1000).toISOString()).limit(10)
 if(withdrawals.error)throw Error('Withdrawal queue unavailable')
 for(const entry of withdrawals.data||[])await sendWithdrawalReceipt(entry)
 const ownerPending=await db.from('shop_withdrawals').select('*').is('owner_notified_at',null).gte('received_at',new Date(Date.now()-23*60*60*1000).toISOString()).limit(10)
 if(ownerPending.error)throw Error('Withdrawal owner queue unavailable')
 for(const entry of ownerPending.data||[]){
  const result=await new Resend(required('RESEND_API_KEY')).emails.send({from,to:'ultimatehikingleague@gmail.com',subject:'Neuer Widerruf im ULTIMATE Shop',text:`Eingang: ${entry.received_at}\nReferenz: ${entry.id}\nName: ${entry.name}\nE-Mail: ${entry.email}\nVertrag/Vertragsteil: ${entry.contract_reference}\n\nBitte zuordnen und gesetzliche Rückabwicklung bearbeiten. Keine automatische Erstattung ausgelöst.`},{idempotencyKey:`withdrawal-owner-${entry.id}`})
  if(result.error)throw Error('Withdrawal owner notification failed')
  const saved=await db.from('shop_withdrawals').update({owner_notified_at:new Date().toISOString()}).eq('id',entry.id)
  if(saved.error)throw Error('Withdrawal owner notification status failed')
 }
}
