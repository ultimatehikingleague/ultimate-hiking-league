import { safeTrackingUrl } from './tracking-url'
// Read-only Gelato v4 adapter. Intentionally no generic POST/create client.
export type GelatoStatusOrder = {
 id:string; orderReferenceId:string; orderType:string; fulfillmentStatus:string;
 connectedOrderIds?:string[]; items?:{id:string;itemReferenceId?:string;productUid:string;quantity:number;fulfillmentStatus?:string}[];
 shipment?:{id?:string;shipmentMethodName?:string;packages?:{id:string;orderItemIds?:string[];trackingCode?:string;trackingUrl?:string}[]};
}
export function statusProjection(raw:string){
 const production:Record<string,string>={created:'not_started',uploading:'not_started',passed:'not_started',draft:'not_started',pending_approval:'not_started',pending_personalization:'not_started',in_production:'in_production',printed:'printed',failed:'failed',canceled:'canceled',on_hold:'on_hold'}
 return {production_status:Object.hasOwn(production,raw)?production[raw]:'unknown',shipping_status:['shipped','in_transit','returned'].includes(raw)?raw:'unknown',delivery_status:raw==='delivered'?'delivered':raw==='returned'?'returned':'unknown'}
}
export async function readGelatoStatus(id:string,reference:string,mode:string):Promise<GelatoStatusOrder>{
 if(!id||id.length>200||!['test','live'].includes(mode))throw Error('INVALID_REFERENCE')
 const key=process.env.GELATO_API_KEY
 if(!key)throw Error('GELATO_NOT_CONFIGURED')
 const response=await fetch('https://order.gelatoapis.com/v4/orders/'+encodeURIComponent(id),{method:'GET',redirect:'error',headers:{'X-API-KEY':key},cache:'no-store',signal:AbortSignal.timeout(15000)})
 if(!response.ok)throw Error(response.status===429?'GELATO_RATE_LIMIT':'GELATO_HTTP_'+response.status)
 const data=await response.json() as GelatoStatusOrder
 if(data.id!==id||data.orderReferenceId!==reference||data.orderType!==(mode==='live'?'order':'draft')||typeof data.fulfillmentStatus!=='string')throw Error('GELATO_REFERENCE_MISMATCH')
 if(!Array.isArray(data.connectedOrderIds??[])||(data.connectedOrderIds?.length||0)>20||!Array.isArray(data.items??[])||(data.shipment!=null&&(typeof data.shipment!=='object'||Array.isArray(data.shipment)||!Array.isArray(data.shipment.packages??[]))))throw Error('GELATO_INVALID_RESPONSE')
 if((data.items?.length||0)>100||(data.shipment?.packages?.length||0)>100
 ||data.items?.some(i=>!i||typeof i.id!=='string'||!i.id||typeof i.productUid!=='string'||!Number.isSafeInteger(i.quantity)||i.quantity<=0)
 ||data.connectedOrderIds?.some(id=>typeof id!=='string'||!id||id.length>200)
 ||data.shipment?.packages?.some(p=>!p||typeof p.id!=='string'||!p.id||!Array.isArray(p.orderItemIds??[])||p.orderItemIds?.some(id=>typeof id!=='string')))
 throw Error('GELATO_INVALID_RESPONSE')
 return data
}
export function statusSnapshot(data:GelatoStatusOrder){
 // Explicit allowlist; no addresses, receipts, URLs to print files or customer data.
 return {raw_status:data.fulfillmentStatus,...statusProjection(data.fulfillmentStatus),items:(data.items||[]).map(i=>({id:i.id,product_uid:i.productUid,quantity:i.quantity,raw_status:i.fulfillmentStatus||null})),packages:(data.shipment?.packages||[]).map(p=>({id:p.id,shipment_id:data.shipment?.id||null,shipping_method_name:data.shipment?.shipmentMethodName||null,tracking_number:p.trackingCode||null,tracking_url:safeTrackingUrl(p.trackingUrl),item_ids:p.orderItemIds||[]}))}
}
