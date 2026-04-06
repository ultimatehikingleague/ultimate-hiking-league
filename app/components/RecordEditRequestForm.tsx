'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'

type Props = {
  recordId: number
  hikerId: number
  initialActivityName: string
  initialActivityDate: string | null
  initialOfficialDistanceKm: number | null
  initialActualDistanceKm: number | null
  initialElapsedTimeText: string | null
  initialElevationGain: number | null
  initialCountry: string
  initialLocation: string
  initialRecordSource: string | null
}

export default function RecordEditRequestForm({
  recordId,
  hikerId,
  initialActivityName,
  initialActivityDate,
  initialOfficialDistanceKm,
  initialActualDistanceKm,
  initialElapsedTimeText,
  initialElevationGain,
  initialCountry,
  initialLocation,
  initialRecordSource,
}: Props) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [activityName, setActivityName] = useState(initialActivityName || '')
  const [activityDate, setActivityDate] = useState(initialActivityDate || '')
  const [officialDistanceKm, setOfficialDistanceKm] = useState(
    initialOfficialDistanceKm != null ? String(initialOfficialDistanceKm) : ''
  )
  const [actualDistanceKm, setActualDistanceKm] = useState(
    initialActualDistanceKm != null ? String(initialActualDistanceKm) : ''
  )
  const [elapsedTimeText, setElapsedTimeText] = useState(
    initialElapsedTimeText || ''
  )
  const [elevationGain, setElevationGain] = useState(
    initialElevationGain != null ? String(initialElevationGain) : ''
  )
  const [country, setCountry] = useState(initialCountry || '')
  const [location, setLocation] = useState(initialLocation || '')
  const [recordSource, setRecordSource] = useState(initialRecordSource || '')
  const [notes, setNotes] = useState('')

  async function handleSubmit() {
    setSaving(true)
    setMessage('')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        setMessage('Keine aktive Session gefunden.')
        return
      }

      const { error } = await supabase.from('record_corrections').insert({
        record_id: recordId,
        hiker_id: hikerId,
        user_id: session.user.id,
        activity_name: activityName.trim() || null,
        activity_date: activityDate || null,
        official_distance_km: officialDistanceKm
          ? Number(officialDistanceKm.replace(',', '.'))
          : null,
        actual_distance_km: actualDistanceKm
          ? Number(actualDistanceKm.replace(',', '.'))
          : null,
        proposed_time_text: elapsedTimeText.trim() || null,
        elevation_gain: elevationGain
          ? Number(elevationGain.replace(',', '.'))
          : null,
        country: country.trim() || null,
        location: location.trim() || null,
        record_source: recordSource.trim() || null,
        notes: notes.trim() || null,
        status: 'pending',
      })

      if (error) {
        setMessage(error.message)
        return
      }

      setMessage('Änderung wurde eingereicht und wird geprüft.')
      setOpen(false)
    } catch (error: any) {
      setMessage(error?.message ?? 'Unbekannter Fehler')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-stone-200 transition hover:bg-white/10"
        >
          Eintrag bearbeiten
        </button>

        {message ? (
          <div className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
            {message}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-4 text-sm font-medium text-white">
        Eintrag bearbeiten
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm text-stone-300">
            Eventname
          </label>
          <input
            type="text"
            value={activityName}
            onChange={(e) => setActivityName(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-stone-300">
            Datum
          </label>
          <input
            type="date"
            value={activityDate}
            onChange={(e) => setActivityDate(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-stone-300">
            Offizielle Distanz
          </label>
          <input
            type="text"
            value={officialDistanceKm}
            onChange={(e) => setOfficialDistanceKm(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-stone-300">
            Gelaufene Distanz
          </label>
          <input
            type="text"
            value={actualDistanceKm}
            onChange={(e) => setActualDistanceKm(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-stone-300">
            Gesamtzeit
          </label>
          <input
            type="text"
            value={elapsedTimeText}
            onChange={(e) => setElapsedTimeText(e.target.value)}
            placeholder="z. B. 11:23"
            className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-stone-300">
            Höhenmeter
          </label>
          <input
            type="text"
            value={elevationGain}
            onChange={(e) => setElevationGain(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-stone-300">
            Land
          </label>
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-stone-300">
            Ort
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm text-stone-300">
            Veranstalter
          </label>
          <input
            type="text"
            value={recordSource}
            onChange={(e) => setRecordSource(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm text-stone-300">
            Notiz
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
          />
        </div>
      </div>

      {message ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-stone-200">
          {message}
        </div>
      ) : null}

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-stone-100 transition hover:bg-white/10 disabled:opacity-50"
        >
          {saving ? 'Wird eingereicht…' : 'Zur Prüfung einreichen'}
        </button>

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-2xl border border-white/10 bg-transparent px-4 py-2 text-sm text-stone-400 transition hover:text-white"
        >
          Abbrechen
        </button>
      </div>
    </div>
  )
}