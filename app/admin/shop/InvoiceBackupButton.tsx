'use client'

import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { synchronizeInvoiceBackup } from '../../lib/shop/invoice-backup'

type DirectoryPicker = (options: {
  id: string
  mode: 'readwrite'
  startIn: 'documents'
}) => Promise<FileSystemDirectoryHandle>

export default function InvoiceBackupButton() {
  const running = useRef(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<Awaited<ReturnType<typeof synchronizeInvoiceBackup>>>()

  async function synchronize() {
    if (running.current) return
    const picker = (window as Window & { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker
    if (!picker || !navigator.locks) {
      setMessage('Bitte öffne die Shop-Administration auf dem Mac in Chrome oder Edge.')
      return
    }
    if (window.location.hostname !== 'www.ultimatehikingleague.com' &&
        window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setMessage('Bitte starte die Sicherung auf www.ultimatehikingleague.com.')
      return
    }

    running.current = true
    setBusy(true)
    setMessage('')
    setResult(undefined)
    try {
      const root = await picker.call(window, { id: 'ultimate-buchhaltung', mode: 'readwrite', startIn: 'documents' })
      if (root.name !== 'Buchhaltung') {
        setMessage('Bitte wähle den bestehenden Ordner „Buchhaltung“.')
        return
      }
      await navigator.locks.request('ultimate-live-invoice-backup', { ifAvailable: true }, async lock => {
        if (!lock) {
          setMessage('Eine Rechnungssynchronisierung läuft bereits in einem anderen Tab.')
          return
        }
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) {
          setMessage('Bitte melde dich erneut als Administrator an.')
          return
        }
        const summary = await synchronizeInvoiceBackup(root, params => fetch(
          '/api/admin/shop/invoice-backup?' + params,
          {
            headers: { Authorization: 'Bearer ' + token },
            cache: 'no-store',
            signal: AbortSignal.timeout(30000),
          },
        ))
        setResult(summary)
      })
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setMessage('Die Sicherung konnte nicht gestartet werden.')
      }
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  return (
    <div className="mt-5 space-y-3">
      <button
        type="button"
        onClick={() => void synchronize()}
        disabled={busy}
        className="rounded-xl bg-emerald-300 px-4 py-2 text-sm font-semibold text-stone-900 disabled:opacity-60"
      >
        {busy ? 'Rechnungen werden geprüft …' : 'Rechnungen synchronisieren'}
      </button>
      <p className="text-xs leading-5 text-stone-400">Wähle den lokalen Ordner „Buchhaltung“ in Chrome oder Edge.</p>
      <div role="status" className="text-sm text-stone-300">
        {message}
        {result && (
          <>
            <p>Neu {result.added} · Bereits vorhanden {result.existing} · Fehlgeschlagen {result.failed.length}</p>
            {result.incomplete && <p>Die Rechnungsliste konnte nicht vollständig geladen werden. Die Zahlen zeigen den bisherigen Stand.</p>}
            {result.failed.length > 0 && <p>Bitte prüfen: {result.failed.join(', ')}</p>}
          </>
        )}
      </div>
    </div>
  )
}
