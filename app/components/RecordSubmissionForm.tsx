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
  const [isOfficialEvent, setIsOfficialEvent] = useState(true)
  const [activityName, setActivityName] = useState('')
  const [description, setDescription] = useState('')
  const [officialDistanceKm, setOfficialDistanceKm] = useState('')
  const [actualDistanceKm, setActualDistanceKm] = useState('')
  const [activityDate, setActivityDate] = useState('')
  const [distanceKm, setDistanceKm] = useState('')
  const [elapsedTimeText, setElapsedTimeText] = useState('')
  const [elevationGain, setElevationGain] = useState('')
  const [country, setCountry] = useState('')
  const [location, setLocation] = useState('')
  const [organizer, setOrganizer] = useState('')
  
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

      if (!activityDate.trim() || !elapsedTimeText.trim() || !proofFile) {
  setErrorMessage('Bitte fülle alle Pflichtfelder aus.')
  setSubmitting(false)
  return
}

if (isOfficialEvent && !activityName.trim()) {
  setErrorMessage('Bitte wähle bzw. benenne ein offizielles Event.')
  setSubmitting(false)
  return
}

if (isOfficialEvent && (!officialDistanceKm.trim() || !actualDistanceKm.trim())) {
  setErrorMessage('Bitte fülle beide Distanzfelder aus.')
  setSubmitting(false)
  return
}

if (!isOfficialEvent && !actualDistanceKm.trim()) {
  setErrorMessage('Bitte gib deine gelaufene Distanz an.')
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

      let parsedDistance: number | null = null

if (isOfficialEvent) {
  const official = Number(officialDistanceKm.replace(',', '.'))
  const actual = Number(actualDistanceKm.replace(',', '.'))

  if (
    Number.isNaN(official) ||
    Number.isNaN(actual) ||
    official <= 0 ||
    actual <= 0
  ) {
    setErrorMessage('Bitte gib gültige Distanzen ein.')
    setSubmitting(false)
    return
  }

  if (actual < official * 0.97) {
    setErrorMessage('Du musst mindestens 97% der offiziellen Distanz erreichen.')
    setSubmitting(false)
    return
  }

  parsedDistance = actual
} else {
  const actual = Number(actualDistanceKm.replace(',', '.'))

  if (Number.isNaN(actual) || actual <= 0) {
    setErrorMessage('Distanz ist ungültig.')
    setSubmitting(false)
    return
  }

  parsedDistance = actual
}
      const parsedElevation =
        elevationGain.trim() === '' ? null : Number(elevationGain.replace(',', '.'))

      const { error: insertError } = await supabase
        .from('record_submissions')
        .insert({
          user_id: session.user.id,
          hiker_id: hikerId,
          submission_type: isOfficialEvent ? 'official_event' : 'private',
          activity_name: isOfficialEvent
            ? activityName.trim()
            : 'Private Wanderung',
          description: !isOfficialEvent ? description.trim() || null : null,
          activity_date: activityDate,
          official_distance_km: isOfficialEvent
            ? Number(officialDistanceKm.replace(',', '.'))
            : null,
          actual_distance_km: Number.isNaN(parsedDistance as number) ? null : parsedDistance,
          distance_km: Number.isNaN(parsedDistance as number) ? null : parsedDistance,
          elapsed_time_text: elapsedTimeText.trim(),
          elevation_gain: Number.isNaN(parsedElevation as number) ? null : parsedElevation,
          country: country.trim() || null,
          location: location.trim() || null,
          record_source: isOfficialEvent
            ? organizer.trim() || null
            : 'private',
          proof_image_url: proofImageUrl,
          notes: notes.trim() || null,
          status: 'pending',
        })

      if (insertError) {
        setErrorMessage(`DB-Fehler: ${insertError.message}`)
        setSubmitting(false)
        return
      }
      

      setIsOfficialEvent(true)
      setActivityName('')
      setDescription('')
      setOfficialDistanceKm('')
      setActualDistanceKm('')
      setActivityDate('')
      setElapsedTimeText('')
      setElevationGain('')
      setCountry('')
      setLocation('')
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
      <div className="flex gap-3 mb-4">
  <button
    type="button"
    onClick={() => setIsOfficialEvent(true)}
    className={`rounded-xl px-4 py-2 text-sm ${
      isOfficialEvent
        ? 'bg-white text-black'
        : 'bg-white/10 text-white'
    }`}
  >
    Offizielles Event
  </button>

  <button
    type="button"
    onClick={() => setIsOfficialEvent(false)}
    className={`rounded-xl px-4 py-2 text-sm ${
      !isOfficialEvent
        ? 'bg-white text-black'
        : 'bg-white/10 text-white'
    }`}
  >
    Private Wanderung
  </button>
</div>
        {isOfficialEvent ? (
  <div>
    <label className="mb-2 block text-sm font-medium text-stone-200">
      Name des offiziellen Events * <span className="text-stone-500">Pflichtangabe</span>
    </label>
    <input
      type="text"
      value={activityName}
      onChange={(e) => setActivityName(e.target.value)}
      placeholder="z. B. Ultimatemarsch Mallorca"
      className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none transition placeholder:text-stone-500 focus:border-white/20 focus:bg-black/20"
    />
  </div>
) : (
  <div>
    <label className="mb-2 block text-sm font-medium text-stone-200">
      Beschreibung <span className="text-stone-500">optional</span>
    </label>
    <input
      type="text"
      value={description}
      onChange={(e) => setDescription(e.target.value)}
      placeholder="z. B. Chiemsee-Umrundung oder Zugspitzbesteigung"
      className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none transition placeholder:text-stone-500 focus:border-white/20 focus:bg-black/20"
    />
  </div>
)}

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

          {isOfficialEvent ? (
  <div className="grid gap-4 md:grid-cols-2">
    <div>
      <label className="mb-2 block text-sm font-medium text-stone-200">
        Offizielle Distanz (km) <span className="text-stone-500">*</span>
      </label>
      <input
        type="text"
        value={officialDistanceKm}
        onChange={(e) => setOfficialDistanceKm(e.target.value)}
        placeholder="z. B. 50"
        className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-medium text-stone-200">
        Tatsächlich gelaufen (km)  <span className="text-stone-500">*</span>
      </label>
      <input
        type="text"
        value={actualDistanceKm}
        onChange={(e) => setActualDistanceKm(e.target.value)}
        placeholder="z. B. 48.7"
        className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
      />
    </div>
  </div>
) : (
  <div>
    <label className="mb-2 block text-sm font-medium text-stone-200">
      Distanz (km) * <span className="text-stone-500">Pflichtangabe</span>
    </label>
    <input
      type="text"
      value={actualDistanceKm}
      onChange={(e) => setActualDistanceKm(e.target.value)}
      placeholder="z. B. 12.5"
      className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
    />
  </div>
)}
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

          
        </div>

        {isOfficialEvent ? (
          <div>
            <label className="mb-2 block text-sm font-medium text-stone-200">
              Veranstalter <span className="text-stone-500">*</span>
            </label>
            <input
              type="text"
              value={organizer}
              onChange={(e) => setOrganizer(e.target.value)}
              placeholder="z. B. Ultimatemarsch"
              className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none transition placeholder:text-stone-500 focus:border-white/20 focus:bg-black/20"
            />
          </div>
        ) : null}

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