'use client'

import { useLocale, useTranslations } from 'next-intl'
import { garminIssueKeys } from '../../i18n/activity-display-messages'
import { formatDistanceKm, formatElevationMeters, formatElapsedTime } from '../lib/activity/display'
import Link from '@/i18n/prototype/LocalizedLink'
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
type GarminMessage = keyof typeof import('../../messages/en.json')['garminDisplay']
const callbackMessages = new Map<string, GarminMessage>([
  ['connected', 'callbackConnected'],
  ['cancelled', 'callbackCancelled'],
  ['permission-required', 'callbackPermissionRequired'],
  ['already-linked', 'callbackAlreadyLinked'],
  ['retry', 'callbackRetry'],
  ['unavailable', 'callbackUnavailable'],
])

const actionErrors = ['signInOriginal', 'finishFailed', 'pleaseSignInAgain', 'actionFailed', 'invalidGarminAddress', 'startFailed', 'storageRequired'] as const

const attemptKey = 'uhl-garmin-attempt'

async function request(path: string, method = 'GET', proof?: string) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const headers = new Headers({ Authorization: `Bearer ${session.access_token}` })
  if (proof) headers.set('X-Garmin-Attempt-Proof', proof)
  return fetch(path, { method, headers, cache: 'no-store' })
}

export default function GarminActivityConnect({ onSelect }: { onSelect?: (activity: GarminInboxActivity, submissionEnabled: boolean) => void }) {
  const t = useTranslations('garminDisplay')
  const locale = useLocale()

  const [connection, setConnection] = useState<Connection | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [pending, setPending] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<GarminMessage | ''>('')
  const [error, setError] = useState<GarminMessage | ''>('')

  const latestLoad = useRef(0)
  const [loadError, setLoadError] = useState<GarminMessage | ''>('')
  const [moreError, setMoreError] = useState<GarminMessage | ''>('')
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
        setLoadError('signInRequired')
        return
      }
      if (response.status === 404) {
        expanded.current = false
        setConnection(null)
        setUnavailable(true)
        setLoadError('')
        return
      }
      if (!response.ok) throw new Error('Garmin inbox failed to load')
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
        if (append) setMoreError('moreFailed')
        else setLoadError('refreshFailed')
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
    if (action === 'disconnect' && !window.confirm(t('disconnectConfirm'))) return
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
        if (!response || response.status === 401) throw new Error('signInOriginal')
        if (!response.ok) throw new Error('finishFailed')
        const { status } = await response.json()
        if (status === 'waiting') {
          await load()
          setMessage('noCallback')
          return
        }
        if (localStorage.getItem(attemptKey) === raw) {
          localStorage.removeItem(attemptKey)
          setPending(false)
        }
        const feedback = callbackMessages.get(status) ?? 'callbackUnavailable'
        if (status === 'connected' || status === 'cancelled') setMessage(feedback)
        else setError(feedback)
        await load()
        return
      }
      const response = action === 'connect' ? await request('/api/garmin/start', 'POST')
        : await request('/api/garmin/connection', 'DELETE')
      if (!response || response.status === 401) throw new Error('pleaseSignInAgain')
      if (!response.ok) {
        // A failed disconnect can still revoke import access. Read the current status.
        if (action === 'disconnect' || response.status === 409) await load()
        throw new Error('actionFailed')
      }
      if (action === 'connect') {
        const address = response.headers.get('x-garmin-authorization-url')
        const url = address && new URL(address)
        if (!url || url.origin !== 'https://connect.garmin.com') throw new Error('invalidGarminAddress')
        const proof = response.headers.get('x-garmin-attempt-proof')
        const expiresAt = Number(response.headers.get('x-garmin-attempt-expires-at'))
        if (!proof || !/^[A-Za-z0-9_-]{43}$/.test(proof) || !Number.isSafeInteger(expiresAt) || expiresAt <= 0) {
          throw new Error('startFailed')
        }
        try {
          localStorage.setItem(attemptKey, JSON.stringify({ proof, expiresAt }))
        } catch {
          throw new Error('storageRequired')
        }
        setPending(true)
        window.location.assign(url)
        return
      }
      latestLoad.current++
      expanded.current = false
      setMoreError('')
      setConnection({ connected: false })
      setMessage('disconnected')
    } catch (error) {
      setError(actionErrors.find(key => error instanceof Error && error.message === key) ?? 'unavailable')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="garmin-heading" className="space-y-4 rounded-2xl border border-white/15 bg-white/5 p-4 sm:p-5">
      <h2 id="garmin-heading" className="text-lg font-semibold text-white">{t('privateGarminActivities')}</h2>
      {connection && (
        <p className="text-sm text-stone-300" role="status">
          {connection.revoked
            ? t('permissionWithdrawn')
            : connection.connected ? t('connectedActivityAccessGranted') : t('notConnected')}
        </p>
      )}
      {pending && connection && !connection.connected && (
        <p className="text-sm text-stone-300">{t('returnHereAfterGrantingAccessIn')}</p>
      )}
      {message && <p className="text-sm text-emerald-200" role="status">{t(message)}</p>}
      {error && <p className="text-sm text-rose-200" role="alert">{t(error)}</p>}
      {loadError && <p className="text-sm text-rose-200" role="alert">{t(loadError)}</p>}
      {unavailable && !loadError && <p className="text-sm text-stone-300" role="status">{t('thePrivateGarminInboxIsUnavailable')}</p>}
      {!connection && !unavailable && !error && !loadError && <p className="text-sm text-stone-300" role="status">{t('loadingGarmin')}</p>}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {pending && connection && !connection.connected && (
          <button type="button" className={primaryButton} disabled={busy} onClick={() => void act('finish')}>{t('finishConnecting')}</button>
        )}
        {connection && (connection.connected
          ? <button type="button" className={button} disabled={busy} onClick={() => void act('disconnect')}>{t('disconnectGarminConnect')}</button>
          : <button type="button" className={primaryButton} disabled={busy} onClick={() => void act('connect')}>{pending ? t('startANewGarminConnectionAttempt') : t('connectGarminConnect')}</button>)}
        {(error || loadError || (connection?.connected && !connection.revoked)) && (
          <button type="button" className={button} disabled={busy || loadingMore} onClick={() => void act('reload')}>{busy ? t('refreshing') : t('refresh')}</button>
        )}
      </div>

      {connection && <Link href="/datenschutz#garmin-connect" className="inline-block text-sm text-stone-300 underline">{t('privacyInformationForTheGarminConnection')}</Link>}
      {importStatus && (
        <div className="space-y-2 text-sm text-stone-300" role="status">
          {!receiving && <p>{t('automaticGarminImportIsCurrentlyPaused')}</p>}
          {importStatus.pending && <p>{importStatus.workerEnabled ? t('garminDataWasReceivedAndIs') : t('dataPending')}</p>}
          {!connection?.activities?.length && (
            <p>{t('emptyInbox')}</p>
          )}
          {importStatus.recentFailure && (
            <p>{t('recentFailure')}</p>
          )}
          {onSelect
            ? <p>{t('importedActivitiesRemainPrivateYouCan')}</p>
            : <p>{t('createYourLeagueProfileToPublish')}</p>}
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
              <h3 className="font-semibold wrap-break-word">{activity.name || t('garminActivity')}</h3>
              <p className="text-xs text-stone-300">{incomplete ? t('incompleteData') : activity.publishable ? t('eligibleAsAPrivateHikeOr') : t('previewOnly')}</p>
            </div>
            <p className="text-stone-300">
              {activity.startTimeInSeconds == null ? t('dateMissing') :
                new Date(activity.startTimeInSeconds * 1000).toLocaleDateString(locale === 'de' ? 'de-DE' : locale === 'en' ? 'en-GB' : locale, { timeZone: 'Europe/Berlin' })} ·{' '}
              {attribution}
            </p>
            <p>{formatDistanceKm(activity.distanceKm) ?? '—'} km · {formatElevationMeters(activity.ascent) ?? '—'} hm · {elapsed ? t('elapsed', { time: elapsed }) : t('elapsedTimeMissing')}</p>
            {activity.publicationIssue && <p className="text-stone-300">{locale === 'de' ? activity.publicationIssue : t(garminIssueKeys.get(activity.publicationIssue) ?? 'insufficientData')}</p>}
            {onSelect && (
              <button type="button" className={button} disabled={busy || Boolean(loadError)} onClick={() => onSelect(activity, connection.submissionEnabled === true)}>
                {t('useActivityDetails')}
              </button>
            )}
          </article>
        )
      })}
      {moreError && <p className="text-sm text-rose-200" role="alert">{t(moreError)}</p>}
      {connection?.nextCursor && (
        <button type="button" className={button} disabled={busy || loadingMore} aria-busy={loadingMore}
          onClick={() => void load('more', connection.nextCursor ?? undefined)}>
          {loadingMore ? t('loading') : t('loadMore')}
        </button>
      )}
    </section>
  )
}
