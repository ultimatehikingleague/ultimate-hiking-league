'use client'

import { formatDistanceKm, formatElevationMeters, formatElapsedTime } from '../lib/activity/display'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { startVisiblePolling } from '../lib/visiblePolling'
import type { GarminInboxActivity } from '../lib/activity/garmin-metrics'

type Connection = {
  connected: boolean
  revoked?: boolean
  submissionEnabled?: boolean
  activities?: GarminInboxActivity[]
  nextCursor?: string | null
  importStatus?: {
    pushEnabled: boolean
    workerEnabled: boolean
    pending: boolean
    recentFailure: boolean
  }
}

const button = 'inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-white/20 px-4 py-2 text-sm font-medium hover:bg-white/10 disabled:opacity-50 sm:w-auto'
const primaryButton = 'inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-950 hover:bg-white disabled:opacity-50 sm:w-auto'
const callbackMessages = new Map([
  ['connected', 'Garmin Connect™ wurde verbunden.'],
  ['cancelled', 'Die Garmin-Verbindung wurde abgebrochen.'],
  ['permission-required', 'Garmin hat keine Freigabe für Aktivitätsdaten erteilt. Starte die Verbindung erneut und erteile die Freigabe.'],
  ['already-linked', 'Dieses Garmin-Konto ist bereits verbunden.'],
  ['retry', 'Dieser Garmin-Verbindungsversuch ist abgelaufen. Starte die Verbindung erneut.'],
  ['unavailable', 'Garmin konnte gerade nicht verbunden werden. Bitte versuche es später erneut.'],
])

const attemptKey = 'uhl-garmin-attempt'

async function request(path: string, method = 'GET', proof?: string) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const headers = new Headers({ Authorization: `Bearer ${session.access_token}` })
  if (proof) headers.set('X-Garmin-Attempt-Proof', proof)
  return fetch(path, { method, headers, cache: 'no-store' })
}

export default function GarminActivityConnect({ onSelect }: { onSelect?: (activity: GarminInboxActivity, submissionEnabled: boolean) => void }) {
  const [connection, setConnection] = useState<Connection | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [pending, setPending] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const latestLoad = useRef(0)
  const [loadError, setLoadError] = useState('')
  const [moreError, setMoreError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const moreInFlight = useRef(false)
  const expanded = useRef(false)
  const inboxOwner = useRef<string | null>(null)

  const load = useCallback(async (mode: 'refresh' | 'poll' | 'more' = 'refresh', cursor?: string) => {
    const append = mode === 'more'
    if (mode !== 'refresh' && moreInFlight.current) return
    if (append) {
      moreInFlight.current = true
      setLoadingMore(true)
    }
    if (mode !== 'poll') setMoreError('')
    const currentOwner = inboxOwner.current
    const loadId = ++latestLoad.current
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (loadId !== latestLoad.current) return
      const owner = session?.user.id ?? null
      if (owner !== inboxOwner.current) {
        inboxOwner.current = owner
        expanded.current = false
        setConnection(null)
      }
      const appendPage = append && cursor && owner === currentOwner
      const statusOnly = mode === 'poll' && expanded.current
      const suffix = appendPage ? `?cursor=${encodeURIComponent(cursor)}` : statusOnly ? '?view=inbox-status' : ''
      const response = session ? await fetch('/api/garmin/activities' + suffix, {
        headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store',
      }) : null
      if (loadId !== latestLoad.current) return
      if (!response || response.status === 401) {
        expanded.current = false
        setConnection(null)
        setUnavailable(true)
        setLoadError('Bitte melde dich im UHL-Profil an, um deine Garmin-Aktivitäten zu sehen.')
        return
      }
      if (response.status === 404) {
        expanded.current = false
        setConnection(null)
        setUnavailable(true)
        setLoadError('')
        return
      }
      if (!response.ok) throw new Error('Garmin konnte gerade nicht geladen werden.')
      const next: Connection = await response.json()
      if (loadId !== latestLoad.current) return
      const active = next.connected && !next.revoked
      if (appendPage && active) expanded.current = true
      else if (!statusOnly || !active) expanded.current = false
      setConnection(current => {
        if (!active || !current || (!appendPage && !statusOnly)) return next
        if (statusOnly) return { ...current, ...next }
        const seen = new Set(current.activities?.map(activity => activity.id))
        return { ...next, activities: [...(current.activities ?? []), ...(next.activities ?? []).filter(activity => !seen.has(activity.id))] }
      })
      setUnavailable(false)
      setLoadError('')
    } catch {
      if (loadId === latestLoad.current) {
        if (append) setMoreError('Weitere Aktivitäten konnten gerade nicht geladen werden. Versuche es erneut.')
        else setLoadError('Der Garmin-Posteingang konnte gerade nicht aktualisiert werden. Versuche es erneut.')
      }
    } finally {
      if (append) {
        moreInFlight.current = false
        setLoadingMore(false)
      }
    }
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(attemptKey)
      if (raw) setPending(Date.now() < JSON.parse(raw).expiresAt)
    } catch {
      // The connect action reports unavailable browser storage before navigating.
    }
    void load()
    const invalidateLoad = () => { latestLoad.current++ }
    return invalidateLoad
  }, [load])

  const importStatus = connection?.importStatus
  const receiving = Boolean(importStatus?.pushEnabled && importStatus.workerEnabled)
  useEffect(() => {
    if (importStatus?.workerEnabled) return startVisiblePolling(() => load('poll'))
  }, [importStatus?.workerEnabled, load])

  async function act(action: 'connect' | 'finish' | 'disconnect' | 'reload') {
    if (action === 'disconnect' && !window.confirm('Garmin Connect™ trennen und private Garmin-Importe löschen? Bereits veröffentlichte UHL-Records bleiben bestehen.')) return
    setBusy(true)
    setMessage('')
    setError('')
    try {
      if (action === 'reload') return await load()
      if (action === 'finish') {
        const raw = localStorage.getItem(attemptKey)
        const attempt = raw ? JSON.parse(raw) as { proof: string; expiresAt: number } : null
        if (!attempt || Date.now() >= attempt.expiresAt) {
          localStorage.removeItem(attemptKey)
          setPending(false)
          throw new Error('Der Verbindungsversuch ist abgelaufen. Starte die Verbindung erneut.')
        }
        const response = await request('/api/garmin/finish', 'POST', attempt.proof)
        if (!response || response.status === 401) throw new Error('Bitte melde dich erneut im ursprünglichen UHL-Kontext an.')
        if (!response.ok) throw new Error('Die Verbindung konnte gerade nicht abgeschlossen werden. Prüfe deine Anmeldung und versuche es erneut.')
        const { status } = await response.json()
        if (status === 'waiting') {
          await load()
          setMessage('Es liegt noch kein Garmin-Rückruf für diesen Versuch vor. Prüfe die Zustimmung bei Garmin oder starte einen neuen Versuch.')
          return
        }
        if (localStorage.getItem(attemptKey) === raw) {
          localStorage.removeItem(attemptKey)
          setPending(false)
        }
        const feedback = callbackMessages.get(status) ?? callbackMessages.get('unavailable')!
        if (status === 'connected' || status === 'cancelled') setMessage(feedback)
        else setError(feedback)
        await load()
        return
      }
      const response = action === 'connect' ? await request('/api/garmin/start', 'POST')
        : await request('/api/garmin/connection', 'DELETE')
      if (!response || response.status === 401) throw new Error('Bitte melde dich erneut an.')
      if (!response.ok) {
        // A failed disconnect can still revoke import access. Read the current status.
        if (action === 'disconnect' || response.status === 409) await load()
        throw new Error('Die Garmin-Aktion konnte nicht abgeschlossen werden. Bitte versuche es erneut.')
      }
      if (action === 'connect') {
        const address = response.headers.get('x-garmin-authorization-url')
        const url = address && new URL(address)
        if (!url || url.origin !== 'https://connect.garmin.com') throw new Error('Ungültige Garmin-Adresse.')
        const proof = response.headers.get('x-garmin-attempt-proof')
        const expiresAt = Number(response.headers.get('x-garmin-attempt-expires-at'))
        if (!proof || !/^[A-Za-z0-9_-]{43}$/.test(proof) || !Number.isSafeInteger(expiresAt) || expiresAt <= 0) {
          throw new Error('Der Garmin-Verbindungsversuch konnte nicht gestartet werden.')
        }
        try {
          localStorage.setItem(attemptKey, JSON.stringify({ proof, expiresAt }))
        } catch {
          throw new Error('UHL benötigt für die Garmin-Verbindung lokalen Browserspeicher. Erlaube den Speicher und versuche es erneut.')
        }
        setPending(true)
        window.location.assign(url)
        return
      }
      latestLoad.current++
      expanded.current = false
      setMoreError('')
      setConnection({ connected: false })
      setMessage('Garmin Connect™ wurde getrennt.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Garmin ist derzeit nicht verfügbar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="garmin-heading" className="space-y-4 rounded-2xl border border-white/15 bg-white/5 p-4 sm:p-5">
      <h2 id="garmin-heading" className="text-lg font-semibold text-white">Private Garmin-Aktivitäten</h2>
      {connection && (
        <p className="text-sm text-stone-300" role="status">
          {connection.revoked
            ? 'Aktivitätsfreigabe entzogen. Der Import ist gesperrt. Trenne Garmin, um die Verbindung erneut einzurichten.'
            : connection.connected ? 'Verbunden · Aktivitätsfreigabe erteilt' : 'Nicht verbunden'}
        </p>
      )}
      {pending && connection && !connection.connected && (
        <p className="text-sm text-stone-300">Kehre nach der Garmin-Zustimmung hierher zurück und schließe die Verbindung ab.</p>
      )}
      {message && <p className="text-sm text-emerald-200" role="status">{message}</p>}
      {error && <p className="text-sm text-rose-200" role="alert">{error}</p>}
      {loadError && <p className="text-sm text-rose-200" role="alert">{loadError}</p>}
      {unavailable && !loadError && <p className="text-sm text-stone-300" role="status">Die private Garmin-Inbox ist für dieses Konto nicht verfügbar.</p>}
      {!connection && !unavailable && !error && !loadError && <p className="text-sm text-stone-300" role="status">Garmin wird geladen …</p>}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {pending && connection && !connection.connected && (
          <button type="button" className={primaryButton} disabled={busy} onClick={() => void act('finish')}>Verbindung abschließen</button>
        )}
        {connection && (connection.connected
          ? <button type="button" className={button} disabled={busy} onClick={() => void act('disconnect')}>Garmin Connect™ trennen</button>
          : <button type="button" className={primaryButton} disabled={busy} onClick={() => void act('connect')}>{pending ? 'Neuen Garmin-Versuch starten' : 'Garmin Connect™ verbinden'}</button>)}
        {(error || loadError || (connection?.connected && !connection.revoked)) && (
          <button type="button" className={button} disabled={busy || loadingMore} onClick={() => void act('reload')}>{busy ? 'Wird aktualisiert …' : 'Aktualisieren'}</button>
        )}
      </div>

      {connection && <Link href="/datenschutz#garmin-connect" className="inline-block text-sm text-stone-300 underline">Datenschutz zur Garmin-Verknüpfung</Link>}
      {importStatus && (
        <div className="space-y-2 text-sm text-stone-300" role="status">
          {!receiving && <p>Der automatische Garmin-Import ist derzeit pausiert.</p>}
          {importStatus.pending && <p>{importStatus.workerEnabled ? 'Garmin-Daten sind eingegangen und werden verarbeitet.' : 'Garmin-Daten sind eingegangen und warten auf Verarbeitung.'}</p>}
          {!connection?.activities?.length && (
            <p>Noch keine Wanderung verfügbar. UHL zeigt hier neue Aktivitäten, sobald Garmin sie nach der Synchronisierung sendet und UHL sie verarbeitet hat. Ältere Garmin-Aktivitäten werden nicht nachgeladen.</p>
          )}
          {importStatus.recentFailure && (
            <p>Ein Garmin-Import konnte in den letzten 24 Stunden nicht vollständig verarbeitet werden. Bereits empfangene Daten siehst du unten. Prüfe bei einer fehlenden Aktivität zuerst, ob sie in Garmin Connect angezeigt wird.</p>
          )}
          {onSelect
            ? <p>Importierte Aktivitäten bleiben privat. Du kannst die übernommenen Angaben im Formular prüfen.</p>
            : <p>Erstelle dein Liga-Profil, um geeignete Garmin-Aktivitäten zu veröffentlichen.</p>}
        </div>
      )}
      {connection?.activities?.map(activity => {
        const device = activity.device?.trim()
        const attribution = device && !/^Garmin\b/i.test(device) ? `Garmin ${device}` : device || 'Garmin'
        const elapsed = formatElapsedTime(activity.elapsed)
        const incomplete = activity.distanceKm == null || activity.ascent == null || !activity.elapsed || activity.startTimeInSeconds == null
        return (
          <article key={activity.id} className="space-y-2 rounded-xl border border-white/10 p-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 className="font-semibold wrap-break-word">{activity.name || 'Garmin-Aktivität'}</h3>
              <p className="text-xs text-stone-300">{incomplete ? 'Daten unvollständig' : activity.publishable ? 'Zur Veröffentlichung geeignet' : 'Nur Vorschau'}</p>
            </div>
            <p className="text-stone-300">
              {activity.startTimeInSeconds == null ? 'Datum fehlt' :
                new Date(activity.startTimeInSeconds * 1000).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })} ·{' '}
              {attribution}
            </p>
            <p>{formatDistanceKm(activity.distanceKm) ?? '—'} km · {formatElevationMeters(activity.ascent) ?? '—'} hm · {elapsed ? `Gesamtzeit ${elapsed}` : 'Gesamtzeit fehlt'}</p>
            {activity.publicationIssue && <p className="text-stone-300">{activity.publicationIssue}</p>}
            {onSelect && (
              <button type="button" className={button} disabled={busy || Boolean(loadError)} onClick={() => onSelect(activity, connection.submissionEnabled === true)}>
                Angaben übernehmen
              </button>
            )}
          </article>
        )
      })}
      {moreError && <p className="text-sm text-rose-200" role="alert">{moreError}</p>}
      {connection?.nextCursor && (
        <button type="button" className={button} disabled={busy || loadingMore} aria-busy={loadingMore}
          onClick={() => void load('more', connection.nextCursor ?? undefined)}>
          {loadingMore ? 'Wird geladen …' : 'Mehr laden'}
        </button>
      )}
    </section>
  )
}
