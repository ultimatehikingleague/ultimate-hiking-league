export function safeTrackingUrl(value:unknown):string|null {
 if(typeof value!=='string')return null
 try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null}catch{return null}
}
