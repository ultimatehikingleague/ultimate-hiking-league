'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatActivityDistanceInput, normalizeActivityDurationText, readActivityDistanceInput } from '../lib/activity/normalize'
import { isLocalActivityImport } from '../lib/activity/development'
import { activityDateInBerlin } from '../lib/activity/compare'
import type { ScreenshotValues } from '../lib/activity/screenshot'
import { privateScreenshotPrefix, screenshotBucket } from '../lib/activity/screenshot-proof'
import { ActivitySummary, type ActivityPreview } from './ActivityImportPreview'
import { type GarminInboxActivity } from '../lib/activity/garmin-metrics'

// Only a type reference is kept here so the OCR implementation stays out
// of the website's JavaScript bundles.
function screenshotImportComponent(): typeof import('./ActivityScreenshotImport').default | null {
  return null
}

type EntryMode = 'screenshot' | 'import' | 'manual'

function activityImportEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    (isLocalActivityImport(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
      (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_ACTIVITY_IMPORT_ENABLED === 'true'))
}

export function activityGpsImportEnabled() {
  return activityImportEnabled() && process.env.NEXT_PUBLIC_ACTIVITY_GPS_ENABLED === 'true'
}

type RecordSubmissionFormProps = {
  initialEntryMode?: EntryMode
  garminActivity?: GarminInboxActivity
  garminSubmissionEnabled?: boolean
  hikerId: number
  onSuccess?: () => void
  onCancel?: () => void
  preselectedEvent?: {
    eventMasterId: number
    title: string
    date: string
    country: string
    city: string
    organizer: string
    distanceKm?: number | null
  }
}

export default function RecordSubmissionForm({
  hikerId,
  onSuccess,
  onCancel,
  preselectedEvent,
  initialEntryMode = 'manual',
  garminActivity,
  garminSubmissionEnabled,
}: RecordSubmissionFormProps) {
  const [isOfficialEvent, setIsOfficialEvent] = useState(!garminActivity)
  const [activityName, setActivityName] = useState(garminActivity?.name ?? '')
  const [description, setDescription] = useState('')
  const [officialDistanceKm, setOfficialDistanceKm] = useState('')
  const [actualDistanceKm, setActualDistanceKm] = useState(garminActivity?.distanceKm?.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }) ?? '')
  const [activityDate, setActivityDate] = useState(() => garminActivity?.startTimeInSeconds == null
    ? ''
    : activityDateInBerlin(new Date(garminActivity.startTimeInSeconds * 1000).toISOString()) ?? '')
  const [elapsedTimeText, setElapsedTimeText] = useState(garminActivity?.elapsed ?? '')
  const [elevationGain, setElevationGain] = useState(garminActivity?.ascent?.toString() ?? '')
  const [country, setCountry] = useState('')
  const [location, setLocation] = useState('')
  const [organizer, setOrganizer] = useState('')
  const [isPublic, setIsPublic] = useState(!garminActivity)
  
  const [notes, setNotes] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)

  const [screenshots, setScreenshots] = useState<File[]>([])
  const screenshotUpload = useRef({ attempt: '', paths: [] as string[] })
  const screenshotValues = useRef<ScreenshotValues>({})
  const [screenshotSelection, setScreenshotSelection] = useState(0)
  const [screenshotPending, setScreenshotPending] = useState(false)
  const [imported, setImported] = useState<{ file: File; activity: ActivityPreview; repeated: boolean; id: string }>()
  const [readingActivity, setReadingActivity] = useState(false)
  const [entryMode, setEntryMode] = useState<EntryMode>(initialEntryMode)
  const fileInputId = useId()
  const activeRead = useRef(false)
  // Keep the OCR flow in source for future providers. Website entry points are disabled.
  const ActivityScreenshotImport = screenshotImportComponent()
  const screenshotImportEnabled = Boolean(ActivityScreenshotImport)
  const importEnabled = !garminActivity && (screenshotImportEnabled || activityGpsImportEnabled())
  const gpsEnabled = !garminActivity && activityGpsImportEnabled()
  const garminReady = garminActivity?.publishable
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
  if (!preselectedEvent) return

  setIsOfficialEvent(true)
  setActivityName(preselectedEvent.title)
  setActivityDate(preselectedEvent.date)
  setCountry(preselectedEvent.country)
  setLocation(preselectedEvent.city)
  setOrganizer(preselectedEvent.organizer)

  if (preselectedEvent.distanceKm !== null && preselectedEvent.distanceKm !== undefined) {
    setOfficialDistanceKm(String(preselectedEvent.distanceKm))
    setActualDistanceKm(String(preselectedEvent.distanceKm))
  }
}, [preselectedEvent])

  async function uploadRecordProof(
    filePath: string,
    proofFile: File
  ) {
    const fileBuffer = await proofFile.arrayBuffer()

    const maxAttempts = 3
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { error } = await supabase.storage
        .from('record-proofs')
        .upload(filePath, fileBuffer, {
          upsert: false,
          contentType: proofFile.type || 'application/octet-stream',
          cacheControl: '3600',
        })

      if (!error) {
        return null
      }

      lastError = error

      console.error('Record proof upload attempt failed', {
        attempt,
        maxAttempts,
        filePath,
        fileName: proofFile.name,
        fileType: proofFile.type,
        fileSize: proofFile.size,
        error,
      })

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1200))
      }
    }

    return lastError
  }

  

  async function requestActivity(file: File, token: string, method: 'POST' | 'PUT', attempt = '') {
    const format = file.name.split('.').pop() ?? ''
    const response = await fetch(`/api/activity-import?format=${encodeURIComponent(format)}&attempt=${encodeURIComponent(attempt)}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
      body: file,
    })
    if (!response.ok) {
      const details = await response.json().catch(() => null)
      throw Error(details?.error ?? 'Aktivitätsimport ist nicht verfügbar.')
    }
    return await response.json() as { activity: ActivityPreview; reference: string; repeated: boolean }
  }

  async function previewActivity(file: File) {
    if (!gpsEnabled || activeRead.current || submitting) return
    activeRead.current = true
    setReadingActivity(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      if (file.size > 4 * 1024 * 1024) throw Error('Die Aktivitätsdatei darf maximal 4 MB groß sein.')
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw Error('Bitte logge dich zuerst ein.')
      const result = await requestActivity(file, session.access_token, 'POST')
      const { activity } = result
      setImported({ ...result, file, id: crypto.randomUUID() })
      if (screenshots.length) return
      if (!preselectedEvent) {
        setIsOfficialEvent(false)
        setIsPublic(false)
        setDescription(activity.name ?? '')
        setActivityDate(activityDateInBerlin(activity.start) ?? '')
      }
      setActualDistanceKm(formatActivityDistanceInput(activity.distanceKm))
      setElapsedTimeText(activity.elapsed === '00:00' ? '' : activity.elapsed ?? '')
      setElevationGain(activity.ascent === null ? '' : String(activity.ascent))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Import fehlgeschlagen.')
    } finally {
      activeRead.current = false
      setReadingActivity(false)
    }
  }

  function clearScreenshotValues() {
    const previous = screenshotValues.current
    const restore = (current: string, original: string | undefined, fallback = '') =>
      original !== undefined && current === original ? fallback : current
    setActualDistanceKm(current => restore(current, previous.distance, String(preselectedEvent?.distanceKm ?? '')))
    setElapsedTimeText(current => restore(current, previous.elapsed))
    setElevationGain(current => restore(current, previous.ascent))
    setDescription(current => restore(current, previous.title))
    setActivityName(current => restore(current, previous.title))
    screenshotValues.current = {}
    setScreenshots([])
    screenshotUpload.current = { attempt: '', paths: [] }
  }

  function confirmScreenshots(files: File[], values: ScreenshotValues) {
    screenshotUpload.current = { attempt: crypto.randomUUID(), paths: [] }
    screenshotValues.current = preselectedEvent ? { ...values, title: undefined } : values
    setScreenshots(files)
    setScreenshotPending(false)
    setErrorMessage('')
    if (!preselectedEvent) {
      setIsOfficialEvent(false)
      setIsPublic(false)
      if (values.title) {
        setDescription(values.title)
        setActivityName(values.title)
      }
    }
    if (values.distance) setActualDistanceKm(values.distance)
    if (values.elapsed) setElapsedTimeText(values.elapsed)
    if (values.ascent) setElevationGain(values.ascent)
  }

  async function handleSubmit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault()
    if (e && garminActivity) return
    if ((garminActivity && (!garminSubmissionEnabled || !garminReady)) || activeRead.current || submitting || screenshotPending) return
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

      if (garminActivity) {
        if (!activityDate) {
          setErrorMessage('Bitte gib ein Datum an.')
          return
        }
        const response = await fetch(`/api/garmin/activities?id=${encodeURIComponent(garminActivity.id)}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hikerId, activity_name: activityName, activityDate, country, location, reviewKey: garminActivity.reviewKey,
          }),
          cache: 'no-store',
        })
        if (response.ok) {
          setSuccessMessage(response.status === 201 ? 'Deine Wanderung wurde veröffentlicht.' : 'Diese Wanderung wurde bereits veröffentlicht.')
          onSuccess?.()
        } else {
          const messages: Record<number, string> = {
            400: 'Bitte prüfe die Länge deiner Angaben.',
            404: 'Die Garmin-Aktivität oder dein Wanderprofil ist nicht verfügbar.',
            409: 'Die Daten oder die Freigabe haben sich geändert oder ein passender Record existiert bereits. Öffne die Garmin-Übersicht erneut.',
            422: 'Die Garmin-Aktivität erfüllt die UHL-Zulassung nicht oder es fehlen erforderliche Daten.',
          }
          setErrorMessage(messages[response.status] ?? 'Die Veröffentlichung ist gerade nicht möglich. Bitte versuche es erneut.')
        }
        return
      }

      if (!activityDate.trim() || (!proofFile && !imported && !screenshots.length)) {
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

      

      let parsedDistance: number | null = null
      const actual = readActivityDistanceInput(actualDistanceKm, screenshots.length ? null : imported?.activity.distanceKm ?? null)

if (isOfficialEvent) {
  const official = Number(officialDistanceKm.replace(',', '.'))

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

  if (Number.isNaN(actual) || actual <= 0) {
    setErrorMessage('Distanz ist ungültig.')
    setSubmitting(false)
    return
  }

  parsedDistance = actual
}
      const parsedElevation =
        elevationGain.trim() === '' ? null : Number(elevationGain.replace(',', '.'))

      const timeInput = elapsedTimeText.trim()
      const importDuration = (imported || screenshots.length) && timeInput ? normalizeActivityDurationText(timeInput) : null
      if ((imported || screenshots.length) && timeInput && (!importDuration || importDuration === '00:00')) {
        setErrorMessage('Bitte gib eine gültige Gesamtzeit mit mindestens einer vollen Minute ein, z. B. 04:51.')
        return
      }

      let proofImageUrl: string
      if (screenshots.length) {
        const { paths, attempt } = screenshotUpload.current
        const storage = supabase.storage.from(screenshotBucket)
        for (const [index, file] of screenshots.entries()) {
          if (paths[index]) continue
          const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[file.type]
          const path = `${session.user.id}/${attempt}/${index}.${extension}`
          const { error } = await storage.upload(path, file, { upsert: false, cacheControl: '0', contentType: file.type })
          if (error) {
            // A previous upload may have committed even if the response was lost.
            const { data: stored } = await storage.download(path)
            const expected = new Uint8Array(await file.arrayBuffer())
            const actual = stored && new Uint8Array(await stored.arrayBuffer())
            if (!actual || actual.length !== expected.length || !actual.every((byte, i) => byte === expected[i])) {
              setErrorMessage('Ein Screenshot konnte nicht gespeichert werden. Bitte versuche es erneut.')
              return
            }
          }
          paths[index] = path
        }
        proofImageUrl = privateScreenshotPrefix + paths.join(',')
      } else if (imported) {
        const result = await requestActivity(imported.file, session.access_token, 'PUT', imported.id)
        proofImageUrl = result.reference
      } else if (proofFile) {
        const fileExt = proofFile.name.split('.').pop()?.toLowerCase() ?? 'file'
        const safeExt = fileExt.replace(/[^a-z0-9]/g, '') || 'file'
        const filePath = `record-${hikerId}/${session.user.id}-${Date.now()}.${safeExt}`

        const uploadError = await uploadRecordProof(filePath, proofFile)

        if (uploadError) {
          console.error('Record proof upload failed', {
            hikerId,
            userId: session.user.id,
            filePath,
            fileName: proofFile.name,
            fileType: proofFile.type,
            fileSize: proofFile.size,
            uploadError,
          })

          setErrorMessage(
            `Upload-Fehler nach mehreren Versuchen: ${uploadError.message || 'Unbekannter Upload-Fehler'}`
          )
          setSubmitting(false)
          return
        }

        const { data: publicUrlData } = supabase.storage
          .from('record-proofs')
          .getPublicUrl(filePath)

        proofImageUrl = publicUrlData.publicUrl
      } else {
        return
      }

      const { error: insertError } = await supabase
        .from('record_submissions')
        .insert({
          user_id: session.user.id,
          hiker_id: hikerId,
          event_master_id:
            isOfficialEvent && preselectedEvent
              ? preselectedEvent.eventMasterId
              : null,
          submission_type: isOfficialEvent ? 'official_event' : 'private',
          is_public: isOfficialEvent ? true : isPublic,
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
          elapsed_time_text: importDuration ?? timeInput,
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

      // A lost response can leave the first write committed. Verify by this attempt's
      // stable proof reference before reporting success on a subsequent submission.
      const storedImport = insertError && (imported || screenshots.length) && await supabase.from('record_submissions')
        .select('id').eq('user_id', session.user.id)
        .eq('proof_image_url', proofImageUrl).maybeSingle()
      if (insertError && !(storedImport && storedImport.data)) {
        setErrorMessage(`DB-Fehler: ${insertError.message}`)
        setSubmitting(false)
        return
      }
      

      setIsOfficialEvent(true)
      setIsPublic(true)
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
      screenshotValues.current = {}
      screenshotUpload.current = { attempt: '', paths: [] }
      setScreenshots([])
      setScreenshotSelection(current => current + 1)
      setImported(undefined)
      setSuccessMessage('Deine Wanderung wurde erfolgreich eingereicht.')

      if (onSuccess) onSuccess()
    } catch (error) {
      setErrorMessage(`Fehler: ${error instanceof Error ? error.message : 'Unbekannt'}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`rounded-[1.75rem] border border-white/10 p-4 shadow-xl shadow-black/10 sm:p-6 ${importEnabled ? "bg-stone-900 text-stone-100 [color-scheme:dark] [&_.text-stone-500]:text-stone-400" : "bg-white/[0.04]"}`}>
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-white">Wanderung hinzufügen</h3>
        {!garminActivity && <p className="mt-1 text-sm text-stone-400">Reiche hier eine neue Wanderung zur Prüfung ein.</p>}
        {garminActivity && (
          <p className="mt-2 text-sm text-stone-300" role="status">
            {garminActivity.publicationIssue ?? 'Prüfe die aus Garmin übernommenen Angaben.'}
          </p>
        )}
      </div>

      {screenshotImportEnabled && importEnabled && <div className="mb-5 grid gap-3 sm:grid-cols-3" role="group" aria-label="Art der Erfassung">
        <button type="button" disabled={readingActivity || submitting} aria-pressed={entryMode === 'screenshot'}
          onClick={() => { setEntryMode('screenshot'); setErrorMessage('') }}
          className={`min-h-12 rounded-2xl px-4 py-3 text-left font-semibold ${entryMode === 'screenshot' ? 'bg-emerald-200 text-emerald-950' : 'border border-white/15 text-white'}`}>
          Garmin Connect Screenshot importieren
        </button>
        {gpsEnabled && <button type="button" disabled={readingActivity || submitting || screenshotPending} aria-pressed={entryMode === 'import'}
          onClick={() => { setEntryMode('import'); setErrorMessage('') }}
          className={`min-h-12 rounded-2xl px-4 py-3 text-left font-semibold ${entryMode === 'import' ? 'bg-emerald-200 text-emerald-950' : 'border border-white/15 text-white'}`}>
          GPS-Datei importieren
        </button>}
        <button type="button" disabled={readingActivity || submitting} aria-pressed={entryMode === 'manual'}
          onClick={() => {
            if (screenshotPending) {
              setScreenshotPending(false)
              setScreenshotSelection(current => current + 1)
            }
            setEntryMode('manual')
            setImported(undefined)
            setErrorMessage('')
          }}
          className={`min-h-12 rounded-2xl px-4 py-3 text-left font-semibold ${entryMode === 'manual' ? 'bg-white text-black' : 'border border-white/15 text-white'}`}>
          Wanderung manuell eintragen
        </button>
      </div>}

      {ActivityScreenshotImport && importEnabled && <div hidden={entryMode !== 'screenshot'}>
        <ActivityScreenshotImport key={screenshotSelection} disabled={submitting || readingActivity}
          onChange={hasFiles => { clearScreenshotValues(); setScreenshotPending(hasFiles) }}
          onConfirm={confirmScreenshots} />
      </div>}

      {gpsEnabled && entryMode === 'import' && (
        <section aria-label="Aktivitätsdatei" tabIndex={0}
          onDragOver={event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault() }}
          onDrop={event => {
            if (!event.dataTransfer.files.length) return
            event.preventDefault()
            if (event.dataTransfer.files.length === 1) void previewActivity(event.dataTransfer.files[0])
            else setErrorMessage('Bitte jeweils eine Aktivitätsdatei auswählen.')
          }}
          onPaste={event => {
            if (!event.clipboardData.files.length) return
            event.preventDefault()
            if (event.clipboardData.files.length === 1) void previewActivity(event.clipboardData.files[0])
            else setErrorMessage('Bitte jeweils eine Aktivitätsdatei einfügen.')
          }}
          className="mb-5 space-y-3 rounded-2xl border border-dashed border-emerald-200/50 bg-emerald-900/15 p-4 sm:p-5">
          <h4 className="font-semibold text-white">1. Aktivität importieren</h4>
          <label htmlFor={fileInputId} className="sr-only">Aktivitätsdatei auswählen</label>
          <input id={fileInputId} type="file" accept=".gpx,.fit,.tcx" disabled={readingActivity || submitting}
            className="block min-h-11 w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-emerald-200 file:px-3 file:py-3 file:text-emerald-950"
            onChange={event => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void previewActivity(file)
            }} />
          <p className="text-sm text-stone-300">GPX, FIT oder TCX bis 4 MB. Du kannst eine Datei auch hierher ziehen oder einfügen, wenn dein Browser sie aus der Zwischenablage bereitstellt.</p>
          <p className="text-sm text-amber-200">Aus GPS-Punkten berechnete Distanz und Höhenmeter können von deiner Tracking-App abweichen.{screenshots.length > 0 && ' Deine bestätigten Angaben und Screenshot-Nachweise bleiben erhalten.'}</p>
          {readingActivity && <p role="status">Aufzeichnung wird gelesen …</p>}
          {imported && <>
            <div className="space-y-3 border-t border-white/15 pt-4" aria-live="polite">
              <h4 className="font-semibold text-white">2. Erkannte Daten prüfen</h4>
              <ActivitySummary activity={imported.activity} repeated={imported.repeated} />
            </div>
            <p className="text-sm text-stone-300">Prüfe die übernommenen Angaben und ergänze fehlende Werte.</p>
            <button type="button" disabled={submitting || readingActivity} className="min-h-11 text-sm underline" onClick={() => setImported(undefined)}>Import entfernen</button>
          </>}
          {!imported && errorMessage && <p role="alert" className="text-sm text-red-200">{errorMessage}</p>}
          {!imported && successMessage && <p role="status" className="text-sm text-emerald-200">{successMessage}</p>}
        </section>
      )}

      {(!importEnabled || garminActivity || entryMode === 'manual' || imported || screenshots.length > 0) && (
      <form onSubmit={handleSubmit} className="space-y-4">
      {imported && <h4 className="font-semibold text-white">3. Fehlende Angaben ergänzen</h4>}
      {!garminActivity && <div className="flex gap-3 mb-4">
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
</div>}
        <label className="block text-sm font-medium text-stone-200">
          Titel {isOfficialEvent && '*'}
          <input
            type="text"
            value={garminActivity || isOfficialEvent ? activityName : description}
            maxLength={garminActivity ? 240 : undefined}
            onChange={event => (garminActivity || isOfficialEvent ? setActivityName : setDescription)(event.target.value)}
            placeholder={isOfficialEvent ? 'z. B. Ultimatemarsch Mallorca' : 'z. B. Chiemsee-Umrundung'}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none placeholder:text-stone-500"
          />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-stone-200">
              Datum *
            </label>
            <input
              type="date"
              value={activityDate}
              required={Boolean(garminActivity)}
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
              readOnly={Boolean(garminActivity)}
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
              readOnly={Boolean(garminActivity)}
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
              Gesamtzeit 
            </label>
            <input
              type="text"
              value={elapsedTimeText}
              readOnly={Boolean(garminActivity)}
              onChange={(e) => setElapsedTimeText(e.target.value)}
              placeholder="z. B. 08:34"
              className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none transition placeholder:text-stone-500 focus:border-white/20 focus:bg-black/20"
            />

            {!garminActivity && <p className="text-xs text-yellow-400 mt-1">
              Bitte Gesamtzeit (inkl. Pausen), nicht nur Gehzeit.
            </p>}
            
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-200">
              Höhenmeter
            </label>
            <input
              type="text"
              value={elevationGain}
              readOnly={Boolean(garminActivity)}
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
            maxLength={garminActivity ? 100 : undefined}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="z. B. Deutschland"
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
            maxLength={garminActivity ? 240 : undefined}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="z. B. Hamburg"
              className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none transition placeholder:text-stone-500 focus:border-white/20 focus:bg-black/20"
            />
          </div>

          {!isOfficialEvent && !garminActivity ? (
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-stone-200">
                    Sichtbarkeit
                  </div>

                  <p className="mt-1 text-xs text-stone-500">
                    Entscheide, ob diese Wanderung in deinem öffentlichen Profil sichtbar ist.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPublic((current) => !current)}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                    isPublic ? 'bg-emerald-500' : 'bg-white/15'
                  }`}
                  aria-pressed={isPublic}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                      isPublic ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              <div className="mt-3 text-xs font-medium text-stone-300">
                {isPublic ? 'Für jeden sichtbar' : 'Nur für mich sichtbar'}
              </div>
            </div>
          ) : null}

          
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

        {screenshots.length > 0 && <div className="rounded-xl border border-emerald-200/30 p-3 text-sm">
          <p className="font-semibold text-emerald-200">Originale als Nachweis übernommen</p>
          <ul className="mt-1 break-all">{screenshots.map((file, index) => <li key={index}>{file.name}</li>)}</ul>
          <button type="button" className="mt-2 min-h-10 underline" disabled={submitting || readingActivity}
            onClick={() => {
              clearScreenshotValues()
              setScreenshotSelection(current => current + 1)
              setEntryMode('screenshot')
            }}>Screenshot-Nachweise entfernen</button>
        </div>}

        {!garminActivity && !imported && !screenshots.length && <div>
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
        </div>}

        {!garminActivity && <div>
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
        </div>}

        {errorMessage ? (
          <div role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
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
            type={garminActivity ? 'button' : 'submit'}
            onClick={garminActivity ? () => void handleSubmit() : undefined}
            disabled={Boolean(garminActivity && (!garminReady || !garminSubmissionEnabled)) || submitting || readingActivity || screenshotPending}
            className="min-h-11 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-stone-100 transition hover:-translate-y-0.5 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Wird gesendet…' : garminActivity ? 'Wanderung veröffentlichen' : imported ? '4. Wanderung einreichen' : 'Wanderung einreichen'}
          </button>

          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-2xl border border-white/10 bg-transparent px-5 py-3 text-sm font-medium text-stone-300 transition hover:bg-white/[0.04] hover:text-white"
            >
              Zurück zur Auswahl
            </button>
          ) : null}
        </div>
      </form>
      )}
      {gpsEnabled && entryMode === 'import' && !imported && onCancel && (
        <button type="button" onClick={onCancel} className="min-h-11 text-sm text-stone-300">Zurück zur Auswahl</button>
      )}
    </div>
  )
}