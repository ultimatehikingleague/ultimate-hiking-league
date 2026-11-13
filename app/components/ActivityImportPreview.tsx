'use client'

import { useState } from 'react'
import type { parseActivity } from '../lib/activity/parse'
import { compareActivity, type SubmittedActivity } from '../lib/activity/compare'
import { supabase } from '../lib/supabase'

export type ActivityPreview = ReturnType<typeof parseActivity>

const activityNumber = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })

function ActivityMetric({ label, value, source }: { label: string; value: string; source: string }) {
  return <div className="min-w-0 rounded-xl bg-stone-950/60 p-3">
    <dt className="text-stone-300">{label}</dt>
    <dd className="mt-1 font-semibold text-white">{value}</dd>
    <dd className="mt-1 text-xs text-stone-300">{source}</dd>
  </div>
}

export function ActivitySummary({ activity, repeated }: { activity: ActivityPreview; repeated?: boolean }) {
  return <div className="space-y-2 text-sm">
    <p>{activity.name || 'Aufgezeichnete Aktivität'} · {activity.format.toUpperCase()}{activity.sport && ` · ${activity.sport}`}</p>
    <p>{activity.start && new Date(activity.start).toLocaleString('de-DE')}{activity.end && ` bis ${new Date(activity.end).toLocaleString('de-DE')}`}</p>
    <dl className="grid grid-cols-2 gap-2">
      <ActivityMetric label="Distanz" value={activity.distanceKm === null ? 'Unbekannt' : `${activityNumber.format(activity.distanceKm)} km`}
        source={activity.distanceSource === 'device' ? 'Summenwert aus der Datei' : activity.distanceSource === 'gps' ? 'Aus GPS-Punkten berechnet' : 'Kein verlässlicher Wert'} />
      <ActivityMetric label="Aufstieg" value={activity.ascent === null ? 'Unbekannt' : `${activity.ascent} m`}
        source={activity.ascentSource === 'device' ? 'Summenwert aus der Datei' : activity.ascentSource === 'profile' ? 'Aus Höhenprofil geschätzt' : 'Kein verlässlicher Wert'} />
      <ActivityMetric label="Abstieg" value={activity.descent === null ? 'Unbekannt' : `${activity.descent} m`}
        source={activity.descentSource === 'device' ? 'Summenwert aus der Datei' : activity.descentSource === 'profile' ? 'Aus Höhenprofil geschätzt' : 'Kein verlässlicher Wert'} />
      <ActivityMetric label="Gesamtzeit" value={activity.elapsed ?? 'Unbekannt'}
        source={`Bewegungszeit ${activity.moving ?? 'unbekannt'}`} />
    </dl>
    {activity.averageSpeed !== null && <p>Ø {activityNumber.format(activity.averageSpeed)} km/h laut Gerät</p>}
    {activity.eligibility === 'exception' && <p className="font-semibold text-amber-300">Außerhalb der regulären Zulassungsgrenzen. Entscheidung durch die Moderation.</p>}
    {activity.eligibility === 'unknown' && <p className="text-amber-200">Zulassungsregel anhand der Datei nicht abschließend prüfbar. Fehlende Werte können ergänzt werden.</p>}
    {activity.warnings.map(warning => <p key={warning} className="text-amber-200">{warning}</p>)}
    {repeated && <p className="text-amber-200">Eine identische Originaldatei wurde bereits eingereicht.</p>}
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
  const [preview, setPreview] = useState<{ activity: ActivityPreview; repeated: boolean }>()
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
      if (!download) { setPreview(await response.json()); return }
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
      <ActivitySummary {...preview} />
    </>}
  </div>
}
