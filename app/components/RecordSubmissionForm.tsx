'use client'

import ReviewFields, { emptyReviewDraft, reviewOptIn } from './reviews/ReviewFields'
import { useLocale, useTranslations } from 'next-intl'
import type { UiFeedback } from '../../i18n/feedback'
import { garminIssueKeys } from '../../i18n/activity-display-messages'
import { formatDistanceKm, formatElevationMeters, formatElapsedTime } from '../lib/activity/display'
import { useEffect, useId, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatActivityDistanceInput, normalizeActivityDurationText, readActivityDistanceInput } from '../lib/activity/normalize'
import { isLocalActivityImport } from '../lib/activity/development'
import { activityDateInBerlin } from '../lib/activity/compare'
import { ActivitySummary, type ActivityPreview } from './ActivityImportPreview'
import { type GarminInboxActivity } from '../lib/activity/garmin-metrics'

const eventSelectClass = 'mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-stone-900 px-3 text-sm text-white'

type EntryMode = 'import' | 'manual'

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
  onSuccess?: (result?: 'review' | 'published') => void
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
  const t = useTranslations('recordSubmission')
  const ui = useTranslations('ui')
  const garminText = useTranslations('garminDisplay')
  const locale = useLocale()
  const errorText = (feedback: UiFeedback<'recordSubmission'>) => {
    if (locale === 'de' && feedback.key === 'importFailed' && feedback.detail) return feedback.detail
    return t(feedback.key, { message: locale === 'de' ? feedback.detail ?? t('unknown') : '' })
  }

  const [garminKind, setGarminKind] = useState<'official_event' | 'private' | undefined>(garminActivity ? 'private' : undefined)
  const [garminEventId, setGarminEventId] = useState<number | null>(null)
  const [isOfficialEvent, setIsOfficialEvent] = useState(!garminActivity)
  const [activityName, setActivityName] = useState(garminActivity?.name ?? '')
  const [description, setDescription] = useState('')
  const [officialDistanceKm, setOfficialDistanceKm] = useState('')
  const [actualDistanceKm, setActualDistanceKm] = useState(garminActivity?.distanceKm?.toString() ?? '')
  const [activityDate, setActivityDate] = useState(() => garminActivity?.startTimeInSeconds == null
    ? ''
    : activityDateInBerlin(new Date(garminActivity.startTimeInSeconds * 1000).toISOString()) ?? '')
  const [elapsedTimeText, setElapsedTimeText] = useState(garminActivity?.elapsed ?? '')
  const [elevationGain, setElevationGain] = useState(garminActivity?.ascent?.toString() ?? '')
  const [country, setCountry] = useState('')
  const [location, setLocation] = useState('')
  const [organizer, setOrganizer] = useState('')
  const [isPublic, setIsPublic] = useState(!garminActivity)
  
  const [reviewEnabled, setReviewEnabled] = useState(false)
  const [reviewDraft, setReviewDraft] = useState(emptyReviewDraft)
  const [notes, setNotes] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)

  const [imported, setImported] = useState<{ file: File; activity: ActivityPreview; repeated: boolean; id: string }>()
  const [readingActivity, setReadingActivity] = useState(false)
  const entryMode = initialEntryMode
  const fileInputId = useId()
  const activeRead = useRef(false)
  const [focusedMetric, setFocusedMetric] = useState<string | null>(null)
  function displayNumber(input: string, format: typeof formatDistanceKm) {
    return input.trim() ? format(Number(input.trim().replace(',', '.')), false) ?? input : input
  }
  const gpsEnabled = !garminActivity && activityGpsImportEnabled()
  const garminReady = garminActivity?.publishable
  const [calendarEvents, setCalendarEvents] = useState<{
    id: number; title: string; city: string | null; country: string | null; brand: string | null
    event_distances: { distance_km: number; label: string | null }[]
  }[]>([])
  const [calendarError, setCalendarError] = useState(false)

  useEffect(() => {
    if (garminKind !== 'official_event' || !activityDate) return
    let active = true
    void supabase.from('events_master').select('id,title,city,country,brand,event_distances(distance_km,label)')
      .eq('event_date', activityDate).order('title').order('id').then(({ data, error }) => {
        if (!active) return
        setCalendarEvents(data ?? [])
        setCalendarError(Boolean(error))
      })
    return () => { active = false }
  }, [garminKind, activityDate])
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<UiFeedback<'recordSubmission'>['key'] | ''>('')
  const [errorMessage, setErrorMessage] = useState<UiFeedback<'recordSubmission'> | null>(null)

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
      throw Error(details?.error ?? 'couldNotRead')
    }
    return await response.json() as { activity: ActivityPreview; reference: string; repeated: boolean }
  }

  async function previewActivity(file: File) {
    if (!gpsEnabled || activeRead.current || submitting) return
    activeRead.current = true
    setReadingActivity(true)
    setErrorMessage(null)
    setSuccessMessage('')
    try {
      if (file.size > 4 * 1024 * 1024) throw Error('theActivityFileMustBeNo')
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw Error('pleaseSignInFirst')
      const result = await requestActivity(file, session.access_token, 'POST')
      const { activity } = result
      setImported({ ...result, file, id: crypto.randomUUID() })
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
      const detail = error instanceof Error ? error.message : undefined
      const key = (['theActivityFileMustBeNo', 'pleaseSignInFirst', 'couldNotRead'] as const).find(candidate => candidate === detail)
      setErrorMessage(key ? { key } : { key: 'importFailed', detail })
    } finally {
      activeRead.current = false
      setReadingActivity(false)
    }
  }

  async function handleSubmit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault()
    if (e && garminActivity) return
    if ((garminActivity && (!garminSubmissionEnabled || !garminKind || !garminReady)) || activeRead.current || submitting) return
    setSubmitting(true)
    setSuccessMessage('')
    setErrorMessage(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        setErrorMessage({ key: 'pleaseSignInFirst' })
        setSubmitting(false)
        return
      }

      if (garminActivity) {
        if (!activityDate) {
          setErrorMessage({ key: 'enterADate' })
          return
        }
        const official = Number(officialDistanceKm.replace(',', '.'))
        if (isOfficialEvent && (!activityName.trim() || !Number.isFinite(official) || official <= 0)) {
          setErrorMessage({ key: 'enterTheEventNameAndOfficial' })
          return
        }
        if (isOfficialEvent && (garminActivity.distanceKm ?? 0) < official * 0.97) {
          setErrorMessage({ key: 'youMustCoverAtLeast97' })
          return
        }
        const response = await fetch(`/api/garmin/activities?id=${encodeURIComponent(garminActivity.id)}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hikerId, activity_name: activityName, activityDate, description, country, location,
            reviewKey: garminActivity.reviewKey, kind: garminKind,
            ...(isOfficialEvent && { officialDistanceKm: official, organizer, eventMasterId: garminEventId }),
          }),
          cache: 'no-store',
        })
        if (response.ok) {
          const result = response.status === 202 ? 'review' : 'published'
          setSuccessMessage(result === 'review' ? 'yourEventParticipationWasSubmittedFor'
            : response.status === 201 ? 'yourHikeWasPublished' : 'thisHikeHasAlreadyBeenPublished')
          onSuccess?.(result)
        } else {
          const messages: Record<number, UiFeedback<'recordSubmission'>['key']> = {
            400: 'checkYourHikeAndEventDetails',
            404: 'theGarminActivityOrYourHiker',
            409: 'activityChanged',
            422: 'checkEligibility',
          }
          setErrorMessage({ key: messages[response.status] ?? 'publishingIsCurrentlyUnavailablePleaseTry' })
        }
        return
      }

      if (!activityDate.trim() || (!proofFile && !imported)) {
        setErrorMessage({ key: 'completeAllRequiredFields' })
        setSubmitting(false)
        return
      }

      if (isOfficialEvent && !activityName.trim()) {
        setErrorMessage({ key: 'selectOrNameAnOfficialEvent' })
        setSubmitting(false)
        return
      }

      if (isOfficialEvent && (!officialDistanceKm.trim() || !actualDistanceKm.trim())) {
        setErrorMessage({ key: 'completeBothDistanceFields' })
        setSubmitting(false)
        return
      }

      if (!isOfficialEvent && !actualDistanceKm.trim()) {
        setErrorMessage({ key: 'enterTheDistanceYouCovered' })
        setSubmitting(false)
        return
      }

      

      let parsedDistance: number | null = null
      const actual = readActivityDistanceInput(actualDistanceKm, imported?.activity.distanceKm ?? null)

if (isOfficialEvent) {
  const official = Number(officialDistanceKm.replace(',', '.'))

  if (
    Number.isNaN(official) ||
    Number.isNaN(actual) ||
    official <= 0 ||
    actual <= 0
  ) {
    setErrorMessage({ key: 'enterValidDistances' })
    setSubmitting(false)
    return
  }

  if (actual < official * 0.97) {
    setErrorMessage({ key: 'youMustCoverAtLeast97' })
    setSubmitting(false)
    return
  }

  parsedDistance = actual
} else {

  if (Number.isNaN(actual) || actual <= 0) {
    setErrorMessage({ key: 'theDistanceIsInvalid' })
    setSubmitting(false)
    return
  }

  parsedDistance = actual
}
      const parsedElevation =
        elevationGain.trim() === '' ? null : Number(elevationGain.replace(',', '.'))

      const timeInput = elapsedTimeText.trim()
      const importDuration = imported && timeInput ? normalizeActivityDurationText(timeInput) : null
      if (imported && timeInput && (!importDuration || importDuration === '00:00')) {
        setErrorMessage({ key: 'invalidTime' })
        return
      }

      let proofImageUrl: string
      if (imported) {
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

          setErrorMessage({ key: 'uploadFailed', detail: uploadError.message })
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
          ...(isOfficialEvent && reviewEnabled && { uhl_review_draft: reviewDraft }),
        })

      // A lost response can leave the first write committed. Verify by this attempt's
      // stable proof reference before reporting success on a subsequent submission.
      const storedImport = insertError && imported && await supabase.from('record_submissions')
        .select('id').eq('user_id', session.user.id)
        .eq('proof_image_url', proofImageUrl).maybeSingle()
      if (insertError && !(storedImport && storedImport.data)) {
        setErrorMessage({ key: 'databaseError', detail: insertError.message })
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
      setReviewEnabled(false)
      setReviewDraft(emptyReviewDraft())
      setProofFile(null)
      setImported(undefined)
      setSuccessMessage('yourHikeWasSubmittedSuccessfully')

      if (onSuccess) onSuccess()
    } catch (error) {
      setErrorMessage({ key: 'submitError', detail: error instanceof Error ? error.message : undefined })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`rounded-[1.75rem] border border-white/10 p-4 shadow-xl shadow-black/10 sm:p-6 ${entryMode === 'import' ? "bg-stone-900 text-stone-100 [color-scheme:dark] [&_.text-stone-500]:text-stone-400" : "bg-white/[0.04]"}`}>
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-white">{t('addAHike')}</h3>
        {!garminActivity && <p className="mt-1 text-sm text-stone-400">{t('submitANewHikeForReview')}</p>}
        {garminActivity && (
          <p className="mt-2 text-sm text-stone-300" role="status">
            {garminKind === 'official_event' && garminReady
              ? t('eventReview')
              : garminActivity.publicationIssue
                ? locale === 'de' ? garminActivity.publicationIssue : garminText(garminIssueKeys.get(garminActivity.publicationIssue) ?? 'insufficientData')
                : t('reviewTheInformationImportedFromGarmin')}
          </p>
        )}
        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-stone-500">
          {t('requiredFields')}
        </p>
      </div>

      {gpsEnabled && entryMode === 'import' && (
        <section aria-label={t('activityFile')} tabIndex={0}
          onDragOver={event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault() }}
          onDrop={event => {
            if (!event.dataTransfer.files.length) return
            event.preventDefault()
            if (event.dataTransfer.files.length === 1) void previewActivity(event.dataTransfer.files[0])
            else setErrorMessage({ key: 'selectOneActivityFileAtA' })
          }}
          onPaste={event => {
            if (!event.clipboardData.files.length) return
            event.preventDefault()
            if (event.clipboardData.files.length === 1) void previewActivity(event.clipboardData.files[0])
            else setErrorMessage({ key: 'pasteOneActivityFileAtA' })
          }}
          className="mb-5 space-y-3 rounded-2xl border border-dashed border-emerald-200/50 bg-emerald-900/15 p-4 sm:p-5">
          <h4 className="font-semibold text-white">{t('stepImportActivity')}</h4>
          <label htmlFor={fileInputId} className="sr-only">{t('chooseAnActivityFile')}</label>
          <input id={fileInputId} type="file" accept=".gpx,.fit,.tcx" disabled={readingActivity || submitting}
            className="block min-h-11 w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-emerald-200 file:px-3 file:py-3 file:text-emerald-950"
            onChange={event => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void previewActivity(file)
            }} />
          <p className="text-sm text-stone-300">{t('fileHelp')}</p>
          <p className="text-sm text-amber-200">{t('differentGpsMetrics')}</p>
          {readingActivity && <p role="status">{t('readingActivity')}</p>}
          {imported && <>
            <div className="space-y-3 border-t border-white/15 pt-4" aria-live="polite">
              <h4 className="font-semibold text-white">{t('stepReviewDetectedData')}</h4>
              <ActivitySummary activity={imported.activity} repeated={imported.repeated} />
            </div>
            <p className="text-sm text-stone-300">{t('reviewTheImportedDetailsAndFill')}</p>
            <button type="button" disabled={submitting || readingActivity} className="min-h-11 text-sm underline" onClick={() => setImported(undefined)}>{t('removeImport')}</button>
          </>}
          {!imported && errorMessage && <p role="alert" className="text-sm text-red-200">{errorText(errorMessage)}</p>}
          {!imported && successMessage && <p role="status" className="text-sm text-emerald-200">{t(successMessage)}</p>}
        </section>
      )}

      {(!gpsEnabled || entryMode === 'manual' || imported) && (
      <form onSubmit={handleSubmit} className="space-y-4">
      {imported && <h4 className="font-semibold text-white">{t('stepFillInMissingDetails')}</h4>}
      {garminActivity && !garminActivity.privateOnly && (
        <fieldset disabled={submitting} className="grid gap-2 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-medium text-stone-200">{t('howWouldYouLikeToSubmit')}</legend>
          {(['private', 'official_event'] as const).map(kind => (
            <label key={kind} className="flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-3 text-sm">
              <input type="radio" name={fileInputId + '-garmin-kind'} checked={garminKind === kind}
                onChange={() => {
                  setGarminKind(kind)
                  setIsOfficialEvent(kind === 'official_event')
                  setGarminEventId(null)
                  setActivityName(kind === 'private' ? garminActivity.name ?? '' : '')
                  setOfficialDistanceKm('')
                  setCountry('')
                  setLocation('')
                  setOrganizer('')
                  setErrorMessage(null)
                }} />
              {kind === 'private' ? t('privateHikeDefault') : t('eventParticipation')}
            </label>
          ))}
        </fieldset>
      )}
      {garminKind === 'official_event' && calendarEvents.length > 0 && (
        <label className="block text-sm font-medium text-stone-200">
          {t('eventFromTheUhlCalendar')}
          <select value={garminEventId ?? ''} className={eventSelectClass}
            onChange={event => {
              const selected = calendarEvents.find(item => item.id === Number(event.target.value))
              setGarminEventId(selected?.id ?? null)
              setActivityName(selected?.title ?? '')
              setCountry(selected?.country ?? '')
              setLocation(selected?.city ?? '')
              setOrganizer(selected?.brand ?? '')
              setOfficialDistanceKm(selected?.event_distances.length === 1 ? String(selected.event_distances[0].distance_km) : '')
            }}>
            <option value="">{t('enterEventDetailsManually')}</option>
            {calendarEvents.map(item => <option key={item.id} value={item.id}>{item.title} · {item.city || item.country || t('noLocationProvided')}</option>)}
          </select>
        </label>
      )}
      {garminKind === 'official_event' && calendarError && <p role="status" className="text-sm">{t('calendarUnavailable')}</p>}
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
    {t('officialEvent')}
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
    {ui('privateHikeLabel')}
  </button>
</div>}
        <label className="block text-sm font-medium text-stone-200">
          {t('title')} {isOfficialEvent && '*'}
          <input
            type="text"
            value={garminActivity || isOfficialEvent ? activityName : description}
            readOnly={garminEventId !== null}
            maxLength={garminActivity ? 240 : undefined}
            onChange={event => (garminActivity || isOfficialEvent ? setActivityName : setDescription)(event.target.value)}
            placeholder={isOfficialEvent ? t('eventExample') : t('hikeExample')}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none placeholder:text-stone-500"
          />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-stone-200">
              {t('date')}
            </label>
            <input
              type="date"
              value={activityDate}
              required={Boolean(garminActivity)}
              onChange={(e) => {
                if (garminKind === 'official_event') {
                  setGarminEventId(null)
                  setCalendarEvents([])
                  setCalendarError(false)
                }
                setActivityDate(e.target.value)
              }}
              className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none transition focus:border-white/20 focus:bg-black/20"
            />
          </div>

          {isOfficialEvent ? (
  <div className="grid gap-4 md:grid-cols-2">
    <div>
      <label className="mb-2 block text-sm font-medium text-stone-200">
        {t('officialDistanceKm')} <span className="text-stone-500">*</span>
      </label>
      {calendarEvents.find(item => item.id === garminEventId)?.event_distances.map(distance => (
        <button type="button" key={distance.distance_km} aria-pressed={officialDistanceKm === String(distance.distance_km)}
          className="mr-2 mb-2 min-h-11 rounded-lg border border-white/15 px-3 text-sm"
          onClick={() => setOfficialDistanceKm(String(distance.distance_km))}>
          {distance.label || `${distance.distance_km} km`}
        </button>
      ))}
      <input
        type="text"
        value={focusedMetric === 'officialDistanceKm' ? officialDistanceKm : displayNumber(officialDistanceKm, formatDistanceKm)}
        onFocus={() => setFocusedMetric('officialDistanceKm')}
        onBlur={() => setFocusedMetric(null)}
        onChange={(e) => setOfficialDistanceKm(e.target.value)}
        placeholder={t('officialDistanceExample')}
        className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-medium text-stone-200">
        {t('distanceCoveredKm')}  <span className="text-stone-500">*</span>
      </label>
      <input
        type="text"
        value={garminActivity ? formatDistanceKm(garminActivity.distanceKm, false) ?? '' : focusedMetric === 'actualDistanceKm' ? actualDistanceKm : displayNumber(actualDistanceKm, formatDistanceKm)}
        onFocus={() => setFocusedMetric('actualDistanceKm')}
        onBlur={() => setFocusedMetric(null)}
              readOnly={Boolean(garminActivity)}
        onChange={(e) => setActualDistanceKm(e.target.value)}
        placeholder={t('coveredDistanceExample')}
        className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
      />
    </div>
  </div>
) : (
  <div>
    <label className="mb-2 block text-sm font-medium text-stone-200">
      {t('distanceKm')} <span className="text-stone-500">{t('required')}</span>
    </label>
    <input
      type="text"
      value={garminActivity ? formatDistanceKm(garminActivity.distanceKm, false) ?? '' : focusedMetric === 'actualDistanceKm' ? actualDistanceKm : displayNumber(actualDistanceKm, formatDistanceKm)}
      onFocus={() => setFocusedMetric('actualDistanceKm')}
      onBlur={() => setFocusedMetric(null)}
              readOnly={Boolean(garminActivity)}
      onChange={(e) => setActualDistanceKm(e.target.value)}
      placeholder={t('distanceExample')}
      className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
    />
  </div>
)}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-stone-200">
              {t('elapsedTime')} 
            </label>
            <input
              type="text"
              value={garminActivity ? formatElapsedTime(garminActivity.elapsed) ?? '' : focusedMetric === 'elapsedTimeText' ? elapsedTimeText : formatElapsedTime(elapsedTimeText) ?? elapsedTimeText}
              onFocus={() => setFocusedMetric('elapsedTimeText')}
              onBlur={() => setFocusedMetric(null)}
              readOnly={Boolean(garminActivity)}
              onChange={(e) => setElapsedTimeText(e.target.value)}
              placeholder={t('durationExample')}
              className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none transition placeholder:text-stone-500 focus:border-white/20 focus:bg-black/20"
            />

            <p className="text-xs text-yellow-400 mt-1">
              {t('durationHelp')}
            </p>
            
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-200">
              {t('elevationGain')}
            </label>
            <input
              type="text"
              value={garminActivity ? formatElevationMeters(garminActivity.ascent, false) ?? '' : focusedMetric === 'elevationGain' ? elevationGain : displayNumber(elevationGain, formatElevationMeters)}
              onFocus={() => setFocusedMetric('elevationGain')}
              onBlur={() => setFocusedMetric(null)}
              readOnly={Boolean(garminActivity)}
              onChange={(e) => setElevationGain(e.target.value)}
              placeholder={t('elevationExample')}
              className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none transition placeholder:text-stone-500 focus:border-white/20 focus:bg-black/20"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-stone-200">
              {t('country')}
            </label>
            <input
              type="text"
              value={country}
              readOnly={garminEventId !== null}
            maxLength={garminActivity ? 100 : undefined}
              onChange={(e) => setCountry(e.target.value)}
              placeholder={t('countryExample')}
              className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none transition placeholder:text-stone-500 focus:border-white/20 focus:bg-black/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-200">
              {t('location')}
            </label>
            <input
              type="text"
              value={location}
              readOnly={garminEventId !== null}
            maxLength={garminActivity ? 240 : undefined}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t('cityExample')}
              className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none transition placeholder:text-stone-500 focus:border-white/20 focus:bg-black/20"
            />
          </div>

          {!isOfficialEvent && !garminActivity ? (
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-stone-200">
                    {t('visibility')}
                  </div>

                  <p className="mt-1 text-xs text-stone-500">
                    {t('chooseWhetherThisHikeAppearsOn')}
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
                {isPublic ? t('visibleToEveryone') : t('visibleOnlyToMe')}
              </div>
            </div>
          ) : null}

          
        </div>

        {isOfficialEvent ? (
          <div>
            <label className="mb-2 block text-sm font-medium text-stone-200">
              {t('organiser')} <span className="text-stone-500">*</span>
            </label>
            <input
              type="text"
              value={organizer}
              readOnly={garminEventId !== null}
              maxLength={garminActivity ? 240 : undefined}
              onChange={(e) => setOrganizer(e.target.value)}
              placeholder={t('organiserExample')}
              className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none transition placeholder:text-stone-500 focus:border-white/20 focus:bg-black/20"
            />
          </div>
        ) : null}

        {!garminActivity && !imported && <div>
          <label className="mb-2 block text-sm font-medium text-stone-200">
            {t('uploadEvidence')}
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
            {t('acceptedFormatsJpgPngWebpOr')}
          </p>
          {proofFile ? (
            <p className="mt-2 text-sm text-stone-300">
              {t('selected')} {proofFile.name}
            </p>
          ) : null}
        </div>}

        {!garminActivity && <div>
          <label className="mb-2 block text-sm font-medium text-stone-200">
            {t('note')}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('optionalAdditionalNotesAboutTheHike')}
            rows={4}
            className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none transition placeholder:text-stone-500 focus:border-white/20 focus:bg-black/20"
          />
        </div>}

        {!garminActivity && isOfficialEvent && <div className="space-y-4 rounded-2xl border border-white/15 p-4">
          <label className="flex items-center gap-3 font-medium">
            <input type="checkbox" className="accent-amber-300" checked={reviewEnabled} onChange={event => setReviewEnabled(event.target.checked)} />
            {reviewOptIn(locale)}
          </label>
          {reviewEnabled && <ReviewFields locale={locale} value={reviewDraft} onChange={setReviewDraft} />}
        </div>}

        {errorMessage ? (
          <div role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {errorText(errorMessage)}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
            {t(successMessage)}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type={garminActivity ? 'button' : 'submit'}
            onClick={garminActivity ? () => void handleSubmit() : undefined}
            disabled={Boolean(garminActivity && (!garminKind || !garminReady || !garminSubmissionEnabled)) || submitting || readingActivity}
            className="min-h-11 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-stone-100 transition hover:-translate-y-0.5 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? t('submitting') : garminActivity && !isOfficialEvent ? t('publishHike') : imported ? t('stepSubmitHike') : t('submitHike')}
          </button>

          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-2xl border border-white/10 bg-transparent px-5 py-3 text-sm font-medium text-stone-300 transition hover:bg-white/[0.04] hover:text-white"
            >
              {preselectedEvent ? t('backToCalendar') : t('backToOptions')}
            </button>
          ) : null}
        </div>
      </form>
      )}
      {gpsEnabled && entryMode === 'import' && !imported && onCancel && (
        <button type="button" onClick={onCancel} className="min-h-11 text-sm text-stone-300">{t('backToOptions')}</button>
      )}
    </div>
  )
}
