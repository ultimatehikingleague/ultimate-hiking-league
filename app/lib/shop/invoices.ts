import { PURCHASE_TEXT, WITHDRAWAL_TEXT, SHOP_LEGAL_VERSION } from './legal'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { orderDB, type ShopOrder } from './orders'
import type { Address } from './validation'
export type Invoice = { order_id: string; number: string; issued_at: string; mode: 'test'|'live'; pdf_base64: string|null; snapshot: { seller: { name: string; address: string; email: string; taxNumber: string }; buyer: Address; lines: { sku: string; name: string; quantity: number; unit_price_cents: number; total_cents: number }[]; shippingCents: number; totalCents: number; paidAt: string; currency: string; terms?: { purchase?: string; withdrawal?: string } } }
const money=(n:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n/100)
export async function renderInvoice(invoice: Invoice) {
 const doc=await PDFDocument.create(), regular=await doc.embedFont(StandardFonts.Helvetica), bold=await doc.embedFont(StandardFonts.HelveticaBold)
 const logo=await doc.embedPng(await readFile(path.join(process.cwd(),'public/ULTIMATE-LOGO-transparent.png')))
 const ink=rgb(.12,.16,.13), muted=rgb(.35,.38,.35)
 let page=doc.addPage([595.28,841.89]), y=790
 // Standard fonts support German text; unsupported customer characters get a visible replacement rather than crashing download.
 const safe=(s:string)=>Array.from(s).map(c=>{try{regular.encodeText(c);return c}catch{return '?'}}).join('')
 const text=(s:string,x:number,at:number,size=10,strong=false)=>page.drawText(safe(s),{x,y:at,size,font:strong?bold:regular,color:ink})
 const wrap=(s:string,width:number,size=10)=>{const out:string[]=[];let line='';for(const word of safe(s).split(/\s+/)){const next=line?line+' '+word:word;if(regular.widthOfTextAtSize(next,size)>width&&line){out.push(line);line=word}else line=next}out.push(line);return out}
 const header=()=>{page.drawImage(logo,{x:47,y:748,width:65,height:65});text('ULTIMATE OUTDOOR STORE',130,785,13,true);text('Made for your journey.',130,766,10);page.drawLine({start:{x:47,y:731},end:{x:548,y:731},thickness:1,color:muted});y=703}
 const footer=()=>{text(invoice.snapshot.seller.name,47,55,9);text(invoice.snapshot.seller.email,47,40,9);text(`Seite ${doc.getPageCount()}`,500,40,9)}
 header()
 text(invoice.mode==='test'?'TESTRECHNUNG - KEINE ECHTE ZAHLUNG':'RECHNUNG',47,y,19,true);y-=29
 text(`Rechnungsnummer: ${invoice.number}`,47,y);text(`Datum: ${new Date(invoice.issued_at).toLocaleDateString('de-DE',{timeZone:'Europe/Berlin'})}`,390,y);y-=18
 text(`Bestellung: ${invoice.order_id}`,47,y,9);y-=36
 const {seller,buyer}=invoice.snapshot
 text('Rechnung an',47,y,10,true);text('Verkäufer',330,y,10,true);y-=18
 const buyerRows=[buyer.firstName+' '+buyer.lastName,buyer.addressLine1,buyer.addressLine2,buyer.postCode+' '+buyer.city,({DE:'Deutschland',AT:'Österreich',CH:'Schweiz'} as Record<string,string>)[buyer.country]||buyer.country].filter(Boolean)
 const sellerRows=[seller.name,...seller.address.split('\n'),...(seller.taxNumber?[`Steuernummer: ${seller.taxNumber}`]:[])]
 for(let i=0;i<Math.max(buyerRows.length,sellerRows.length);i++){if(buyerRows[i])text(buyerRows[i],47,y,10);if(sellerRows[i])text(sellerRows[i],330,y,10);y-=16}y-=28
 text('Artikel / Artikelnummer',47,y,10,true);text('Menge',325,y,10,true);text('Einzelpreis',385,y,10,true);text('Gesamt',495,y,10,true);y-=14
 page.drawLine({start:{x:47,y},end:{x:548,y},thickness:.5,color:muted});y-=21
 for(const line of invoice.snapshot.lines){const names=wrap(line.name,260);const height=names.length*14+31;if(y-height<160){footer();page=doc.addPage([595.28,841.89]);header()}
 names.forEach((s,i)=>text(s,47,y-i*14));text(String(line.quantity),337,y);text(money(line.unit_price_cents),385,y);text(money(line.total_cents),490,y);y-=names.length*14+3;text(line.sku,47,y,8);y-=28}
 if(y<220){footer();page=doc.addPage([595.28,841.89]);header()}
 text('Versandkosten',47,y);text(money(invoice.snapshot.shippingCents),490,y);y-=25
 page.drawLine({start:{x:47,y},end:{x:548,y},thickness:.7,color:muted});y-=26
 text('Gesamtbetrag',47,y,13,true);text(money(invoice.snapshot.totalCents),478,y,13,true);y-=30
 text('Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.',47,y,10);y-=22
 text(`Bezahlt am ${new Date(invoice.snapshot.paidAt).toLocaleDateString('de-DE',{timeZone:'Europe/Berlin'})}. Kein weiterer Betrag offen.`,47,y,10)
 footer();return Buffer.from(await doc.save())
}
export async function invoiceForOrder(order:ShopOrder) {
 if(order.status!=='paid')throw new Error('Paid order required')
 const db=orderDB(), seller={name:'Philipp Dobrinski / ULTIMATE',address:'Ansbacher Straße 4a\n91452 Wilhermsdorf\nDeutschland',email:'ultimatehikingleague@gmail.com',taxNumber:process.env.SHOP_SELLER_TAX_NUMBER?.trim()||''}
 const {data,error}=await db.rpc('shop_issue_invoice',{p_order_id:order.id,p_seller:seller,p_terms:{version:SHOP_LEGAL_VERSION,purchase:PURCHASE_TEXT,withdrawal:WITHDRAWAL_TEXT,tax:'Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.'}})
 if(error||!data?.[0])throw new Error('Invoice currently unavailable')
 const invoice=data[0] as Invoice
 if(invoice.pdf_base64)return {invoice,pdf:Buffer.from(invoice.pdf_base64,'base64')}
 const pdf=await renderInvoice(invoice)
 const saved=await db.from('shop_invoices').update({pdf_base64:pdf.toString('base64')}).eq('order_id',order.id).is('pdf_base64',null)
 if(saved.error)throw new Error('Invoice storage unavailable')
 return {invoice,pdf}
}
