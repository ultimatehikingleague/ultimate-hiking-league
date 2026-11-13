'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function LaunchControl() {
 const [live,setLive]=useState<boolean|null>(null)
 const [confirm,setConfirm]=useState(false)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 useEffect(()=>{ void supabase.rpc('milestone_shop_is_live').then(({data,error})=>{ if(error)setError('Freigabestatus konnte nicht geladen werden.');else setLive(data===true) }) },[])
 async function change() {
  if(live===null || busy)return
  setBusy(true);setError('')
  try {
   const {data,error}=await supabase.rpc('set_milestone_shop_live',{p_live:!live})
   if(error)throw error
   setLive(data===true);setConfirm(false)
  }catch{setError('Freigabe konnte nicht geändert werden. Bitte erneut prüfen.')}finally{setBusy(false)}
 }
 return <section className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-6">
  <h2 className="text-xl font-semibold">{live===null?'Freigabestatus wird geprüft …':live?'Milestone-Shop ist öffentlich freigegeben':'Backstage – öffentlicher Shop geschlossen'}</h2>
  <p className="mt-3 text-sm leading-6 text-stone-300">Du kannst Angebote und Codes vorbereiten. Erst die gemeinsame Freigabe öffnet den Shop, die Einlösung und die Milestone-Anzeige in den Hiker-Profilen. Als aktiv markierte Angebote erscheinen dann im Shop.</p>
  <a href="/admin/milestone-shop/vorschau" className="mt-4 inline-flex rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold">Geschützte Prämienvorschau →</a>
  {!confirm?<button disabled={live===null||busy} onClick={()=>setConfirm(true)} className="ml-3 mt-4 rounded-xl border border-white/20 px-4 py-2 text-sm disabled:opacity-40">{live?'Öffentlichen Shop schließen':'Launch vorbereiten'}</button>:<div className="mt-4 rounded-xl border border-amber-400/40 p-4"><p>{live?'Shop und Einlösung für die Community wieder schließen?':'Jetzt wirklich öffentlich starten? Alle aktiven Angebote und die Milestone-Guthaben werden für die Community sichtbar. Einlösungen werden möglich.'}</p><button disabled={busy} onClick={()=>void change()} className="mt-3 rounded-xl bg-cyan-300 px-4 py-2 font-bold text-slate-950">{busy?'Wird gespeichert …':live?'Jetzt schließen':'Jetzt öffentlich freigeben'}</button><button disabled={busy} onClick={()=>setConfirm(false)} className="ml-3 px-4 py-2">Abbrechen</button></div>}
  {error&&<p role="alert" className="mt-4 text-red-300">{error}</p>}
 </section>
}
