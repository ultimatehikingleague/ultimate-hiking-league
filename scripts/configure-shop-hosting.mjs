// Upload only allow-listed shop settings. Never print secret values.
import fs from 'node:fs'
import os from 'node:os'
import crypto from 'node:crypto'
import { parseEnv } from 'node:util'
const root=new URL('../',import.meta.url), file=name=>new URL(name,root)
const local=parseEnv(fs.readFileSync(file('.env.local'),'utf8'))
const live=parseEnv(fs.readFileSync(file('.env.shop-live.local'),'utf8'))
const settings={...Object.fromEntries(['GELATO_API_KEY','SHOP_TOKEN_SECRET','SHOP_SELLER_TAX_NUMBER'].map(k=>[k,local[k]])),...Object.fromEntries(['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','PAYPAL_MERCHANT_ID','PAYPAL_WEBHOOK_ID'].map(k=>[k,live[k]])),SHOP_PAYMENT_MODE:'live',SHOP_ORIGIN:'https://www.ultimatehikingleague.com',SHOP_CHECKOUT_ENABLED:'false',SHOP_LIVE_APPROVED:'false',SHOP_FULFILLMENT_ENABLED:'false',SHOP_CONFIRMATIONS_ENABLED:'false'}
for(const [key,value] of Object.entries(settings))if(!value)throw Error('Missing setting: '+key)
const auth=JSON.parse(fs.readFileSync(os.homedir()+'/Library/Application Support/com.vercel.cli/auth.json','utf8'))
const url='https://api.vercel.com/v10/projects/prj_RcGB0GQCbVmqTMtOSzousYGfCktT/env?teamId=team_KOoenx7C4xYAHYtDHZVgGQsu'
const headers={Authorization:'Bearer '+auth.token,'Content-Type':'application/json'}
const listing=await fetch(url,{headers});const existing=await listing.json();if(!listing.ok)throw Error('Environment lookup failed')
const cron=existing.envs?.find(x=>x.key==='CRON_SECRET'&&x.target.includes('production'))
if(!cron)settings.CRON_SECRET=crypto.randomBytes(32).toString('hex')
for(const [key,value] of Object.entries(settings)){
 const response=await fetch(url+'&upsert=true',{method:'POST',headers,body:JSON.stringify({key,value,type:'encrypted',target:['production']})})
 if(!response.ok)throw Error('Environment update failed: '+key+' HTTP '+response.status)
 console.log('Configured: '+key)
}
console.log('Production settings prepared; checkout and fulfillment remain disabled. Redeploy required.')
