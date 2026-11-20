'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const periods = [
  { days: 1, label: 'Heute' },
  { days: 7, label: '7 Tage' },
  { days: 30, label: '30 Tage' },
  { days: 0, label: 'Gesamt' },
]

const starterLimit = 1000
const integer = new Intl.NumberFormat('de-DE')
const percentage = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })
const distance = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dateTime = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Berlin',
})
const day = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeZone: 'UTC' })

type GarminSnapshot = {
  active: number
  registered: number
  retained_deregistered: number
  private_published: number
  event_published: number
  event_pending: number
  published_today: number
  distance_km: number
  elevation_gain: number
  recent: {
    id: number
    hiker_id: number
    hiker_name: string | null
    published_at: string | null
    activity_date: string | null
    distance_km: number | null
    device_model: string | null
    is_event: boolean
  }[]
}

export default function GarminMonitoring() {
  const [days, setDays] = useState(7)
  const [result, setResult] = useState<{ days: number; data: GarminSnapshot | null } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    supabase.rpc('garmin_admin_monitoring', { p_days: days })
      .abortSignal(controller.signal)
      .then(({ data, error }) => {
        if (!controller.signal.aborted) {
          setResult({ days, data: error ? null : data })
        }
      })
    return () => controller.abort()
  }, [days])

  const current = result?.days === days ? result : null
  const data = current?.data

  return (
    <section aria-labelledby="garmin-monitoring-title" className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 md:p-8">
      <h2 id="garmin-monitoring-title" className="text-2xl font-bold text-white">Garmin-Monitoring</h2>

      {result?.data && (
        <div className="mt-4">
          <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-stone-400">Aktiv mit Aktivitätsexport</dt>
              <dd className="text-lg font-semibold">{integer.format(result.data.active)}</dd>
            </div>
            <div>
              <dt className="text-stone-400">Starter-Limit laut Datenbank</dt>
              <dd className="text-lg font-semibold">
                {integer.format(result.data.registered)} / {integer.format(starterLimit)}
                {' · '}{percentage.format(result.data.registered / starterLimit * 100)} %
              </dd>
            </div>
            <div>
              <dt className="text-stone-400">Gespeicherte Garmin-Abmeldungen</dt>
              <dd className="text-lg font-semibold">{integer.format(result.data.retained_deregistered)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-stone-400">
            Das Starter-Limit wird anhand der noch registrierten Konten geschätzt. Gelöschte Verbindungen fehlen in der Historie.
            Die Gesamtzahl jemals verbundener oder getrennter Konten ist unbekannt.
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <h3 className="mr-2 font-semibold">Veröffentlichungen</h3>
        {periods.map(period => (
          <button
            key={period.days}
            type="button"
            aria-pressed={days === period.days}
            onClick={() => setDays(period.days)}
            className="rounded-full border border-white/15 px-3 py-1 text-sm text-stone-300 hover:bg-white/10 aria-pressed:border-emerald-400/50 aria-pressed:bg-emerald-400/15 aria-pressed:text-emerald-200"
          >
            {period.label}
          </button>
        ))}
      </div>

      {!current && <p role="status" className="mt-3 text-sm text-stone-400">Garmin-Daten werden geladen …</p>}
      {current && !data && <p role="alert" className="mt-3 text-sm text-amber-300">Garmin-Daten konnten nicht geladen werden.</p>}

      {data && (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            {[
              ['Privat · automatisch veröffentlicht', integer.format(data.private_published)],
              ['Event · freigegeben und veröffentlicht', integer.format(data.event_published)],
              ['Event · eingereicht und offen', integer.format(data.event_pending)],
              ['Heute veröffentlicht', integer.format(data.published_today)],
              ['Veröffentlichte Distanz', distance.format(data.distance_km) + ' km'],
              ['Veröffentlichter Aufstieg', integer.format(data.elevation_gain) + ' hm'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-black/10 p-3">
                <dt className="text-xs text-stone-400">{label}</dt>
                <dd className="mt-1 text-lg font-semibold text-white">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-stone-400">
            Zeiträume nach Berliner Kalender. Für offene Events gilt das Einreichungsdatum.
          </p>

          <h3 className="mb-2 mt-5 font-semibold">Neueste Garmin-Veröffentlichungen</h3>
          {data.recent.length === 0 ? (
            <p className="text-sm text-stone-400">Keine Garmin-Veröffentlichungen in diesem Zeitraum.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-stone-400">
                  <tr>
                    {['Hiker', 'Wanderdatum', 'Veröffentlicht', 'Distanz', 'Modell', 'Typ und Status'].map(label => (
                      <th key={label} scope="col" className="py-2 pr-4 font-medium">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map(record => (
                    <tr key={record.id} className="border-t border-white/10 text-stone-200">
                      <td className="py-2 pr-4">
                        <Link href={`/${record.hiker_id}`} className="text-emerald-300 hover:underline">
                          {record.hiker_name || `Hiker ${record.hiker_id}`}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap py-2 pr-4">{record.activity_date ? day.format(new Date(record.activity_date)) : '—'}</td>
                      <td className="whitespace-nowrap py-2 pr-4">{record.published_at ? dateTime.format(new Date(record.published_at)) : '—'}</td>
                      <td className="whitespace-nowrap py-2 pr-4">{record.distance_km === null ? '—' : distance.format(record.distance_km) + ' km'}</td>
                      <td className="py-2 pr-4">{record.device_model || '—'}</td>
                      <td className="py-2">{record.is_event ? 'Event · Adminfreigabe' : 'Privat · automatisch verifiziert'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
