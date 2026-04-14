'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'

type Props = {
  recordId: number
  hikerId: number
  isOfficialEvent: boolean
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
  isOfficialEvent,
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
  const [proofFile, setProofFile] = useState<File | null>(null)

  async function uploadCorrectionProof(
    filePath: string,
    proofFile: File
  ) {
    const fileBuffer = await proofFile.arrayBuffer()

    const { error } = await supabase.storage
      .from('record-proofs')
      .upload(filePath, fileBuffer, {
        upsert: false,
        contentType: proofFile.type || 'application/octet-stream',
        cacheControl: '3600',
      })

    return error
  }

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

      let proofUrl: string | null = null

      if (proofFile) {
        const fileExt = proofFile.name.split('.').pop()?.toLowerCase() ?? 'file'
        const safeExt = fileExt.replace(/[^a-z0-9]/g, '') || 'file'
        const filePath = `record-corrections/${hikerId}/${session.user.id}-${recordId}-${Date.now()}.${safeExt}`

        const uploadError = await uploadCorrectionProof(filePath, proofFile)

        if (uploadError) {
          setMessage(`Upload-Fehler: ${uploadError.message}`)
          return
        }

        const { data: publicUrlData } = supabase.storage
          .from('record-proofs')
          .getPublicUrl(filePath)

        proofUrl = publicUrlData.publicUrl
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
        proof_url: proofUrl,
        status: 'pending',
      })

      if (error) {
        setMessage(error.message)
        return
      }

      setMessage('Änderung wurde eingereicht und wird geprüft.')
      setProofFile(null)
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
        {isOfficialEvent ? (
          <div className="md:col-span-2 rounded-2xl border border-white/10 bg-black/10 p-4">
            <div className="mb-3 text-xs uppercase tracking-[0.18em] text-stone-500">
              Feste Eventdaten
            </div>

            <div className="grid gap-3 md:grid-cols-2 text-sm text-stone-200">
              <div>
                <div className="text-stone-500">Eventname</div>
                <div className="mt-1">{activityName || '—'}</div>
              </div>

              <div>
                <div className="text-stone-500">Datum</div>
                <div className="mt-1">{activityDate || '—'}</div>
              </div>

              <div>
                <div className="text-stone-500">Offizielle Distanz</div>
                <div className="mt-1">{officialDistanceKm || '—'}</div>
              </div>

              <div>
                <div className="text-stone-500">Gelaufene Distanz</div>
                <div className="mt-1">{actualDistanceKm || '—'}</div>
              </div>
            </div>

            <p className="mt-4 text-xs text-stone-500">
              Diese Eventdaten wurden bereits geprüft und können nicht nachträglich geändert werden.
            </p>
          </div>
        ) : (
          <>
            <div>
              <label className="mb-2 block text-sm text-stone-300">
                Titel
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
                Distanz
              </label>
              <input
                type="text"
                value={actualDistanceKm}
                onChange={(e) => setActualDistanceKm(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
              />
            </div>
          </>
        )}

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
            Neuer Nachweis <span className="text-stone-500">optional</span>
          </label>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null
              setProofFile(file)
            }}
            className="block w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-stone-300 file:mr-4 file:rounded-xl file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-white/15"
          />
          {proofFile ? (
            <p className="mt-2 text-sm text-stone-300">
              Ausgewählt: {proofFile.name}
            </p>
          ) : null}
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