'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'

type RecordSubmissionFormProps = {
  hikerId: number
  onSuccess?: () => void
  onCancel?: () => void
}

export default function RecordSubmissionForm({
  hikerId,
  onSuccess,
  onCancel,
}: RecordSubmissionFormProps) {
  const [activityName, setActivityName] = useState('')
  const [activityDate, setActivityDate] = useState('')
  const [distanceKm, setDistanceKm] = useState('')
  const [elapsedTimeText, setElapsedTimeText] = useState('')
  const [elevationGain, setElevationGain] = useState('')
  const [country, setCountry] = useState('')
  const [location, setLocation] = useState('')
  const [recordSource, setRecordSource] = useState('')
  const [notes, setNotes] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setSuccessMessage('')
    setErrorMessage('')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        setErrorMessage('Bitte logge dich zuerst ein.')
        setSubmitting(false)
        return
      }

      if (
        !activityName.trim() ||
        !activityDate.trim() ||
        !distanceKm.trim() ||
        !elapsedTimeText.trim() ||
        !proofFile
      ) {
        setErrorMessage('Bitte fülle alle Pflichtfelder aus.')
        setSubmitting(false)
        return
      }

      const fileExt = proofFile.name.split('.').pop()?.toLowerCase() ?? 'file'
      const safeExt = fileExt.replace(/[^a-z0-9]/g, '') || 'file'
      const filePath = `record-${hikerId}/${session.user.id}-${Date.now()}.${safeExt}`

      const { error: uploadError } = await supabase.storage
        .from('record-proofs')
        .upload(filePath, proofFile, {
          upsert: false,
        })

      if (uploadError) {
        setErrorMessage(`Upload-Fehler: ${uploadError.message}`)
        setSubmitting(false)
        return
      }

      const { data: publicUrlData } = supabase.storage
        .from('record-proofs')
        .getPublicUrl(filePath)

      const proofImageUrl = publicUrlData.publicUrl

      const parsedDistance =
        distanceKm.trim() === '' ? null : Number(distanceKm.replace(',', '.'))
      const parsedElevation =
        elevationGain.trim() === '' ? null : Number(elevationGain.replace(',', '.'))

      const { error: insertError } = await supabase
        .from('record_submissions')
        .insert({
          user_id: session.user.id,
          hiker_id: hikerId,
          activity_name: activityName.trim(),
          activity_date: activityDate,
          distance_km: Number.isNaN(parsedDistance as number) ? null : parsedDistance,
          elapsed_time_text: elapsedTimeText.trim(),
          elevation_gain: Number.isNaN(parsedElevation as number) ? null : parsedElevation,
          country: country.trim() || null,
          location: location.trim() || null,
          record_source: recordSource.trim() || null,
          proof_image_url: proofImageUrl,
          notes: notes.trim() || null,
          status: 'pending',
        })

      if (insertError) {
        setErrorMessage(`DB-Fehler: ${insertError.message}`)
        setSubmitting(false)
        return
      }

      setActivityName('')
      setActivityDate('')
      setDistanceKm('')
      setElapsedTimeText('')
      setElevationGain('')
      setCountry('')
      setLocation('')
      setRecordSource('')
      setNotes('')
      setProofFile(null)
      setSuccessMessage('Deine Wanderung wurde erfolgreich eingereicht.')

      if (onSuccess) onSuccess()
    } catch (error: any) {
      setErrorMessage(`Fehler: ${error?.message ?? 'Unbekannt'}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/10">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-white">Wanderung hinzufügen</h3>
        <p className="mt-1 text-sm text-stone-400">
          Reiche hier eine neue Wanderung zur Prüfung ein.
        </p>
        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-stone-500">
          * Pflichtfelder
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-stone-200">
            Name der Wanderung / Veranstaltung *
          </label>
          <input
            type="text"
            value={activityName}
            onChange={(e) => setActivityName(e.target.value)}
            placeholder="z. B. Ultimatemarsch 50 km oder Privater Trainingshike"
            className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none transition placeholder:text-stone-500 focus:border-white/20 focus:bg-black/20"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-stone-200">
              Datum *
            </label>
            <input
              type="date"
              value={activityDate}
              onChange={(e) => setActivityDate(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none transition focus:border-white/20 focus:bg-black/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-200">
              Distanz in km *
            </label>
            <input
              type="text"
              value={distanceKm}
              onChange={(e) => setDistanceKm(e.target.value)}
              placeholder="z. B. 50 oder 42,2"
              className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none transition placeholder:text-stone-500 focus:border-white/20 focus:bg-black/20"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-stone-200">
              Gesamtzeit *
            </label>
            <input
              type="text"
              value={elapsedTimeText}
              onChange={(e) => setElapsedTimeText(e.target.value)}
              placeholder="z. B. 08:34"
              className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none transition placeholder:text-stone-500 focus:border-white/20 focus:bg-black/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-200">
              Höhenmeter
            </label>
            <input
              type="text"
              value={elevationGain}
              onChange={(e) => setElevationGain(e.target.value)}
              placeholder="z. B. 1200"
              className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none transition placeholder:text-stone-500 focus:border-white/20 focus:bg-black/20"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-stone-200">
              Land
            </label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="z. B. DE"
              className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none transition placeholder:text-stone-500 focus:border-white/20 focus:bg-black/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-200">
              Ort
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="z. B. Hamburg"
              className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none transition placeholder:text-stone-500 focus:border-white/20 focus:bg-black/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-200">
              Quelle
            </label>
            <input
              type="text"
              value={recordSource}
              onChange={(e) => setRecordSource(e.target.value)}
              placeholder="z. B. Privat oder Offizielles Event"
              className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none transition placeholder:text-stone-500 focus:border-white/20 focus:bg-black/20"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-stone-200">
            Nachweis hochladen *
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
          <p className="mt-2 text-xs text-stone-500">
            Erlaubt: JPG, PNG, WEBP oder PDF
          </p>
          {proofFile ? (
            <p className="mt-2 text-sm text-stone-300">
              Ausgewählt: {proofFile.name}
            </p>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-stone-200">
            Notiz
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional: zusätzliche Hinweise zur Wanderung"
            rows={4}
            className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none transition placeholder:text-stone-500 focus:border-white/20 focus:bg-black/20"
          />
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
            {successMessage}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-stone-100 transition hover:-translate-y-0.5 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Wird gesendet…' : 'Wanderung einreichen'}
          </button>

          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-2xl border border-white/10 bg-transparent px-5 py-3 text-sm font-medium text-stone-300 transition hover:bg-white/[0.04] hover:text-white"
            >
              Abbrechen
            </button>
          ) : null}
        </div>
      </form>
    </div>
  )
}