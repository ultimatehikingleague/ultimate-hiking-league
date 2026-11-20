'use client'

import { createTranslator, useLocale, useTranslations } from 'next-intl'
import { activityWarningKeys } from '../../i18n/activity-display-messages'
import { formatDistanceKm, formatElevationMeters, formatElapsedTime } from '../lib/activity/display'
import { useState } from 'react'
import type { parseActivity } from '../lib/activity/parse'
import { compareActivity, type SubmittedActivity } from '../lib/activity/compare'
import { supabase } from '../lib/supabase'

export type ActivityPreview = ReturnType<typeof parseActivity>

function ActivityMetric({ label, value, source }: { label: string; value: string; source: string }) {
  return <div className="min-w-0 rounded-xl bg-stone-950/60 p-3">
    <dt className="text-stone-300">{label}</dt>
    <dd className="mt-1 font-semibold text-white">{value}</dd>
    <dd className="mt-1 text-xs text-stone-300">{source}</dd>
  </div>
}

type PreviewProps = { activity: ActivityPreview; repeated?: boolean }
type PreviewTranslator = ReturnType<typeof useTranslations<'activityPreview'>>

export function ActivitySummary(props: PreviewProps) {
  const t = useTranslations('activityPreview')
  return <ActivitySummaryView {...props} t={t} locale={useLocale()} />
}

function ActivitySummaryView({ activity, repeated, t, locale }: PreviewProps & { t: PreviewTranslator; locale: string }) {
  const activityNumber = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })
  const displayedDate = (value: string) => new Date(value).toLocaleString(locale === 'de' ? 'de-DE' : locale === 'en' ? 'en-GB' : locale)

  return <div className="space-y-2 text-sm">
    <p>{activity.name || t('recordedActivity')} · {activity.format.toUpperCase()}{activity.sport && ` · ${activity.sport}`}</p>
    <p>{activity.start && displayedDate(activity.start)}{activity.end && ' ' + t('until', { date: displayedDate(activity.end) })}</p>
    <dl className="grid grid-cols-2 gap-2">
      <ActivityMetric label={t('distance')} value={activity.distanceKm === null ? t('unknown') : `${formatDistanceKm(activity.distanceKm)} km`}
        source={activity.distanceSource === 'device' ? t('totalFromTheFile') : activity.distanceSource === 'gps' ? t('calculatedFromGpsPoints') : t('noReliableValue')} />
      <ActivityMetric label={t('ascent')} value={activity.ascent === null ? t('unknown') : `${formatElevationMeters(activity.ascent)} m`}
        source={activity.ascentSource === 'device' ? t('totalFromTheFile') : activity.ascentSource === 'profile' ? t('estimatedFromTheElevationProfile') : t('noReliableValue')} />
      <ActivityMetric label={t('descent')} value={activity.descent === null ? t('unknown') : `${formatElevationMeters(activity.descent)} m`}
        source={activity.descentSource === 'device' ? t('totalFromTheFile') : activity.descentSource === 'profile' ? t('estimatedFromTheElevationProfile') : t('noReliableValue')} />
      <ActivityMetric label={t('elapsedTime')} value={formatElapsedTime(activity.elapsed) ?? t('unknown')}
        source={t('movingTime', { time: activity.moving ?? t('unknown').toLowerCase() })} />
    </dl>
    {activity.averageSpeed !== null && <p>{t('deviceSpeed', { speed: activityNumber.format(activity.averageSpeed) })}</p>}
    {activity.eligibility === 'exception' && <p className="font-semibold text-amber-300">{t('outsideLimits')}</p>}
    {activity.eligibility === 'unknown' && <p className="text-amber-200">{t('eligibilityUncertain')}</p>}
    {activity.warnings.map(warning => <p key={warning} className="text-amber-200">{locale === 'de' ? warning : t(activityWarningKeys.get(warning) ?? 'unlistedWarning')}</p>)}
    {repeated && <p className="text-amber-200">{t('anIdenticalOriginalFileHasAlready')}</p>}
  </div>
}

function ActivityComparison({ activity, submission }: { activity: ActivityPreview; submission: SubmittedActivity }) {
  const status = {
    match: '✓ Stimmt überein',
    different: 'Abweichung',
    missing: 'Angabe fehlt',
    uncertain: 'Dateiwert fehlt oder ist unsicher',
  }
  return <>
    <p className="text-xs text-stone-300">Der grüne Haken zeigt die Übereinstimmung mit der Datei. Echtheit und Freigabe werden separat geprüft.</p>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead><tr>{['Parameter', 'Aus der Datei', 'Gespeicherte Einreichung', 'Vergleich'].map(label => (
          <th key={label} scope="col" className="px-2 py-2 text-stone-300">{label}</th>
        ))}</tr></thead>
        <tbody>{compareActivity(activity, submission).map(row => (
          <tr key={row.parameter} className="border-t border-white/10">
            <th scope="row" className="px-2 py-2 font-medium">{row.parameter}</th>
            <td className="px-2 py-2">{row.original ?? '—'}</td>
            <td className="px-2 py-2">{row.submitted ?? '—'}</td>
            <td className={`px-2 py-2 ${row.result === 'match' ? 'text-emerald-300' : 'text-amber-200'}`}>{status[row.result]}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  </>
}

export function ActivityOriginal({ id, submission }: { id: number; submission: SubmittedActivity }) {
  const [preview, setPreview] = useState<PreviewProps & { t: PreviewTranslator }>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function load(download = false) {
    setBusy(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw Error('Bitte erneut anmelden.')
      const response = await fetch(`/api/activity-import?submission=${encodeURIComponent(id)}&download=${download ? '1' : '0'}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!response.ok) throw Error('Der private Nachweis konnte nicht geladen werden.')
      if (!download) {
        const [data, catalog] = await Promise.all([response.json(), import('../../messages/de.json')])
        const t = createTranslator({ locale: 'de', namespace: 'activityPreview', messages: { activityPreview: catalog.default.activityPreview } })
        setPreview({ ...data, t })
        return
      }
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'aktivitaet'
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nachweis konnte nicht geladen werden.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="space-y-2">
    <div className="flex flex-wrap gap-4">
      <button type="button" disabled={busy} onClick={() => void load()} className="underline">Importdetails anzeigen</button>
      <button type="button" disabled={busy} onClick={() => void load(true)} className="underline">Original herunterladen</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {preview && <>
      <ActivityComparison activity={preview.activity} submission={submission} />
      <ActivitySummaryView {...preview} locale="de" />
    </>}
  </div>
}
