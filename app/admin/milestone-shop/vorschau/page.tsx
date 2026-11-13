'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import PartnerBenefits from '../../../milestone-shop/PartnerBenefits'
type Reward={id:number;title:string;description:string|null;partner_name:string;points_cost:number;image_url:string|null;is_active:boolean;reward_type:string;redemption_url:string|null;redemption_instructions:string|null}
export default function Preview(){
 const [rewards,setRewards]=useState<Reward[]>([])
 const [state,setState]=useState('Prüfe Admin-Zugriff …')
 useEffect(()=>{let cancelled=false;async function load(){
  const {data:{user}}=await supabase.auth.getUser()
  if(!user){if(!cancelled)setState('Kein Zugriff – bitte als Administrator anmelden.');return}
  const {data:admin,error:authError}=await supabase.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle()
  if(authError||!admin){if(!cancelled)setState('Kein Zugriff – nur für Administratoren.');return}
  const {data,error}=await supabase.from('reward_catalog').select('id,title,description,partner_name,points_cost,image_url,is_active,reward_type,redemption_url,redemption_instructions').order('display_position', { nullsFirst: false }).order('points_cost').order('id')
  if(!cancelled){setRewards(data??[]);setState(error?'Vorschau konnte nicht geladen werden.':'')}
 }void load();return()=>{cancelled=true}},[])
 return <main className="min-h-screen bg-[#080d16] px-6 py-12 text-white"><div className="mx-auto max-w-6xl">
 <Link href="/admin/milestone-shop" className="text-cyan-300">← Zur Prämienverwaltung</Link>
 <p className="mt-8 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-amber-100">Geschützte Vorschau · Auch inaktive Entwürfe · Keine Einlösung und kein Codeverbrauch</p>
 {!state && <div className="mt-8"><PartnerBenefits preview /></div>}
 <p className="mt-10 text-xs font-semibold tracking-[0.24em] text-cyan-300">MILESTONE REWARDS</p><h1 className="mt-3 text-4xl font-bold">Deine Belohnungen.</h1>
 {state?<p role="status" className="mt-8">{state}</p>:<><p className="mt-4 text-slate-400">Entdecke exklusive Prämien unserer Partner. Deine gesammelten Milestones öffnen dir die Tür zu besonderen Belohnungen.</p>
 {!rewards.length&&<p className="mt-8">Noch keine Prämien angelegt.</p>}
 <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">{rewards.map(r=><article key={r.id} className="overflow-hidden rounded-3xl border border-white/15 bg-[#151f2a]">
 <div className="relative flex h-60 items-center justify-center bg-[#1d2b37] p-8">{r.image_url?<img src={r.image_url} alt={r.partner_name} className="h-full w-full object-contain"/>:<span className="text-slate-400">Logo noch nicht hinterlegt</span>}<span className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1 text-xs">{r.reward_type==='product'?'Produkt':r.reward_type==='discount'?'Rabatt':'Gutschein'}</span></div>
 <div className="p-6"><p className="text-xs uppercase tracking-widest text-cyan-300">{r.partner_name}</p><h2 className="mt-3 text-2xl font-bold">{r.title}</h2><p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-400">{r.description}</p><p className="mt-6 text-2xl font-bold text-cyan-300">{r.points_cost.toLocaleString('de-DE')} <span className="text-sm">Milestones</span></p><button disabled className="mt-5 w-full rounded-xl bg-cyan-300 px-4 py-4 font-bold text-slate-950 opacity-60">Belohnung abholen · Vorschau</button><p className="mt-3 text-xs text-amber-200">{r.is_active?'Aktiv – erscheint bei öffentlicher Freigabe':'Inaktiver Entwurf'}</p>
 {r.redemption_instructions&&<details className="mt-5 text-sm"><summary>Einlösehinweise prüfen</summary><p className="mt-3 whitespace-pre-line">{r.redemption_instructions}</p>{r.redemption_url&&<a href={r.redemption_url} target="_blank" rel="noreferrer" className="mt-3 block break-all text-cyan-300">{r.redemption_url}</a>}</details>}</div></article>)}</div></>}
 </div></main>
}
