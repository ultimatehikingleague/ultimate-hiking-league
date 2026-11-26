'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function LaunchControl() {
  const [closed, setClosed] = useState<boolean | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void supabase.rpc('milestone_shop_emergency_closed').then(({ data, error }) => {
      if (error) setError('Freigabestatus konnte nicht geladen werden.')
      else setClosed(data === true)
    })
  }, [])

  async function change() {
    if (closed === null || busy) return
    setBusy(true)
    setError('')
    try {
      const { error } = await supabase.rpc('set_milestone_shop_live', { p_live: closed })
      if (error) throw error
      setClosed(!closed)
      setConfirm(false)
    } catch {
      setError('Notfallsperre konnte nicht geändert werden. Bitte erneut prüfen.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-6">
    <h2 className="text-xl font-semibold">{closed === null ? 'Freigabestatus wird geprüft …' : closed ? 'Notfallsperre aktiv' : 'Automatische Freigabe aktiv'}</h2>
    <p className="mt-3 text-sm leading-6 text-stone-300">Der Shop öffnet am 01.12.2026 um 00:01 Uhr MEZ, sofern die Notfallsperre ausgeschaltet ist. Aktive Angebote erscheinen erst ab der Öffnung.</p>
    <a href="/admin/milestone-shop/vorschau" className="mt-4 inline-flex rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold">Geschützte Prämienvorschau →</a>
    {!confirm ? <button disabled={closed === null || busy} onClick={() => setConfirm(true)} className="ml-3 mt-4 rounded-xl border border-white/20 px-4 py-2 text-sm disabled:opacity-40">{closed ? 'Notfallsperre aufheben' : 'Notfallsperre einschalten'}</button> :
      <div className="mt-4 rounded-xl border border-amber-400/40 p-4">
        <p>{closed ? 'Automatische Freigabe wieder zulassen?' : 'Öffentlichen Shop und Einlösungen sperren?'}</p>
        <button disabled={busy} onClick={() => void change()} className="mt-3 rounded-xl bg-cyan-300 px-4 py-2 font-bold text-slate-950">{busy ? 'Wird gespeichert …' : closed ? 'Sperre aufheben' : 'Shop sperren'}</button>
        <button disabled={busy} onClick={() => setConfirm(false)} className="ml-3 px-4 py-2">Abbrechen</button>
      </div>}
    {error && <p role="alert" className="mt-4 text-red-300">{error}</p>}
  </section>
}
