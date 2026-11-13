'use client'

import Papa from 'papaparse'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

const button = 'rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50'

function getError(error: unknown) {
  return error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Unbekannter Fehler'
}

export default function VoucherCodes({ rewardId, title, initiallyOpen }: { rewardId: number; title: string; initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen)
  const [text, setText] = useState('')
  const [header, setHeader] = useState(false)
  const [stats, setStats] = useState<{ available: number; assigned: number } | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [version, setVersion] = useState(0)
  const lock = useRef(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function load() {
      setRefreshing(true)
      setStats(null)
      setError('')
      try {
        const [available, assigned] = await Promise.all([
          supabase.from('reward_voucher_codes').select('id', { count: 'exact', head: true }).eq('reward_id', rewardId).eq('is_assigned', false),
          supabase.from('reward_voucher_codes').select('id', { count: 'exact', head: true }).eq('reward_id', rewardId).eq('is_assigned', true),
        ])
        if (available.error) throw available.error
        if (assigned.error) throw assigned.error
        if (!cancelled) setStats({ available: available.count ?? 0, assigned: assigned.count ?? 0 })
      } catch (err) {
        if (!cancelled) setError(`Bestand konnte nicht geladen werden: ${getError(err)}`)
      } finally {
        if (!cancelled) setRefreshing(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [open, rewardId, version])

  const preview = useMemo(() => {
    if (!text.trim()) return { codes: [] as string[], duplicates: 0, error: '' }
    const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy', dynamicTyping: false })
    // A single-column file needs no delimiter detection.
    const errors = result.errors.filter(item => item.code !== 'UndetectableDelimiter')
    if (errors.length) return { codes: [], duplicates: 0, error: 'Die Datei konnte nicht eindeutig gelesen werden. Bitte CSV mit einer Code-Spalte verwenden.' }
    const rows = header ? result.data.slice(1) : result.data
    if (rows.some(row => row.length !== 1)) return { codes: [], duplicates: 0, error: 'Bitte genau eine Spalte verwenden: ein Gutscheincode pro Zeile.' }
    const values = rows.map(row => row[0].trim()).filter(Boolean)
    if (values.some(code => /[\r\n\x00-\x1F\x7F]/.test(code))) return { codes: [], duplicates: 0, error: 'Ein Code enthält einen Zeilenumbruch oder ein ungültiges Steuerzeichen.' }
    const codes = [...new Set(values)]
    return { codes, duplicates: values.length - codes.length, error: codes.length > 500 ? 'Bitte höchstens 500 unterschiedliche Codes pro Import verwenden.' : '' }
  }, [text, header])

  async function readFile(file?: File) {
    if (!file || lock.current) return
    setError('')
    setMessage('')
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setError('Bitte eine CSV- oder Textdatei auswählen. PDF-Dateien werden noch nicht unterstützt.')
      return
    }
    if (file.size > 1024 * 1024) {
      setError('Bitte eine Datei mit höchstens 1 MB auswählen.')
      return
    }
    lock.current = true
    setBusy(true)
    try {
      const content = await file.text()
      setText(content)
      setHeader(false)
    } catch {
      setError('Die Datei konnte nicht gelesen werden.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  async function importCodes() {
    if (lock.current || !stats || refreshing || preview.error || preview.codes.length === 0) return
    lock.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { data, error: importError } = await supabase.from('reward_voucher_codes')
        .upsert(preview.codes.map(code => ({ reward_id: rewardId, code, is_assigned: false })), { onConflict: 'code', ignoreDuplicates: true })
        .select('id')
      if (importError) throw importError
      const inserted = data?.length ?? 0
      setMessage(`${inserted} Codes importiert. ${preview.codes.length - inserted} bereits vorhandene Codes übersprungen. Bestehende Codes bleiben unverändert.`)
      setText('')
      setHeader(false)
      setVersion(previous => previous + 1)
    } catch (err) {
      setError(`Import fehlgeschlagen: ${getError(err)}`)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return <div id={`gutscheincodes-${rewardId}`} className="mt-5 scroll-mt-6 border-t border-white/10 pt-4">
    <button type="button" className={button} aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? 'Gutscheincodes ausblenden' : 'Gutscheincodes & Bestand'}</button>
    {open && <div className="mt-5 space-y-4">
      <h4 className="font-semibold">Codes für „{title}“</h4>
      {refreshing ? <p role="status" className="text-sm text-stone-400">Bestand wird geladen …</p> : stats && <dl className="grid grid-cols-3 gap-3 text-center">
        {[['Gesamt', stats.available + stats.assigned], ['Verfügbar', stats.available], ['Vergeben', stats.assigned]].map(([label, value]) => <div key={label} className="rounded-xl bg-white/5 p-3"><dt className="text-xs text-stone-400">{label}</dt><dd className="mt-1 text-lg font-bold">{value}</dd></div>)}
      </dl>}
      <button type="button" disabled={busy || refreshing} onClick={() => setVersion(value => value + 1)} className={button}>Bestand aktualisieren</button>
      <p className="text-xs leading-5 text-stone-400">Die Stückzahl ergibt sich automatisch aus den Codes. Vergeben bedeutet: Der Code wurde einem Hiker zugeteilt. Jeder Code darf systemweit nur einmal vorkommen.</p>
      {error && <p role="alert" className="break-words text-sm text-red-200">{error}</p>}
      {message && <p role="status" className="text-sm text-emerald-200">{message}</p>}
      <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
        <label className="block text-sm text-stone-300">CSV- oder Textdatei (eine Code-Spalte)<input type="file" accept=".csv,.txt,text/csv,text/plain" className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void readFile(file) }} /></label>
        <label className="block text-sm text-stone-300">Oder Codes einfügen, einen pro Zeile<textarea rows={5} value={text} onChange={event => { setText(event.target.value); setMessage('') }} className="mt-2 w-full rounded-xl border border-white/15 bg-[#141312] px-4 py-3 font-mono text-sm outline-none focus:border-cyan-400" /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={header} onChange={event => setHeader(event.target.checked)} />Erste Zeile ist eine Überschrift</label>
        {preview.error ? <p role="alert" className="text-sm text-red-200">{preview.error}</p> : preview.codes.length > 0 && <div className="rounded-xl bg-black/20 p-4">
          <p className="text-sm">{preview.codes.length} unterschiedliche Codes · {preview.duplicates} doppelte Einträge entfernt</p>
          <p className="mt-2 text-xs text-stone-400">Vorschau der ersten {Math.min(5, preview.codes.length)} Codes:</p>
          <ul className="mt-2 space-y-1 font-mono text-sm">{preview.codes.slice(0, 5).map(code => <li className="break-all" key={code}>{code}</li>)}</ul>
        </div>}
        <button type="button" onClick={() => void importCodes()} disabled={!stats || refreshing || !!preview.error || preview.codes.length === 0} className={`${button} border-cyan-400/30 bg-cyan-400/10 text-cyan-200`}>{busy ? 'Wird verarbeitet …' : `${preview.codes.length} Codes importieren`}</button>
      </fieldset>
    </div>}
  </div>
}
