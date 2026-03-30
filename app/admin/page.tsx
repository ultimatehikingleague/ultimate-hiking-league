'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import ProfileBrandBar from '../components/ProfileBrandBar'

type AdminUserRow = {
  user_id: string
  email: string | null
}

type ClaimRequest = {
  id: number
  hiker_id: number
  user_id: string
  email: string | null
  profile_name: string | null
  message: string | null
  social_link: string | null
  proof_url: string | null
  status: string | null
  created_at: string | null
  reviewed_at: string | null
  admin_note: string | null
}

type RecordSubmission = {
  id: number
  user_id: string
  hiker_id: number | null
  activity_name: string
  description: string | null
  submission_type: string | null
  activity_date: string
  distance_km: number | null
  official_distance_km: number | null
  actual_distance_km: number | null
  elapsed_time_text: string | null
  elevation_gain: number | null
  country: string | null
  location: string | null
  record_source: string | null
  proof_image_url: string
  notes: string | null
  status: string | null
  admin_note: string | null
  created_at: string | null
  reviewed_at: string | null
}

type SubmissionDraft = {
  activity_name: string
  description: string
  submission_type: string
  activity_date: string
  distance_km: string
  official_distance_km: string
  actual_distance_km: string
  elapsed_time_text: string
  elevation_gain: string
  country: string
  location: string
  record_source: string
  notes: string
  admin_note: string
}
type EventMasterMatch = {
  id: number
  slug: string
  title: string | null
  city: string | null
  country: string | null
  country_code: string | null
  event_date: string | null
}

type EventDistanceMatch = {
  id: number
  event_id: number
  distance_km: number
  label: string | null
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function isSameDate(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false
  return a.slice(0, 10) === b.slice(0, 10)
}
async function findOrCreateEventMaster(
  draft: SubmissionDraft
): Promise<{ eventMasterId: number; matched: boolean }> {
  const normalizedName = normalizeText(draft.activity_name)
  const normalizedLocation = getCanonicalLocation(draft.location)
  const normalizedCountry = normalizeText(draft.country)

  const { data: existingEvents, error: existingEventsError } = await supabase
    .from('events_master')
    .select('id, slug, title, city, country, country_code, event_date')
    .order('event_date', { ascending: true })

  if (existingEventsError) {
    throw new Error(
      `Fehler beim Laden vorhandener Events: ${existingEventsError.message}`
    )
  }


  const matchedEvent = (existingEvents as EventMasterMatch[]).find((event) => {
  const eventTitle = normalizeText(event.title)
  const eventCity = getCanonicalLocation(event.city)
  const eventCountry = normalizeText(event.country)
  const eventCountryCode = normalizeText(event.country_code)

  const sameDate = isSameDate(event.event_date, draft.activity_date)

  const sameName =
    !!eventTitle &&
    !!normalizedName &&
    (eventTitle.includes(normalizedName) ||
      normalizedName.includes(eventTitle) ||
      eventTitle.split(' ').some((part) => normalizedName.includes(part)))

  const sameCountry =
    !normalizedCountry ||
    !eventCountry ||
    eventCountry.includes(normalizedCountry) ||
    normalizedCountry.includes(eventCountry) ||
    eventCountryCode === normalizedCountry

  const locationCompatible =
    !normalizedLocation ||
    !eventCity ||
    eventCity.includes(normalizedLocation) ||
    normalizedLocation.includes(eventCity)

  return sameDate && sameName && sameCountry && locationCompatible
})

  if (matchedEvent) {
    return { eventMasterId: matchedEvent.id, matched: true }
  }

  const slugBase = normalizeText(draft.activity_name)
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')

  const slug = `${slugBase || 'event'}-${draft.activity_date}`

  const { data: createdEvent, error: createEventError } = await supabase
    .from('events_master')
    .insert({
      slug,
      title: draft.activity_name.trim(),
      city: draft.location.trim() || null,
      country: draft.country.trim() || null,
      country_code: draft.country.trim().toUpperCase() || null,
      event_date: draft.activity_date,
      brand:
        draft.submission_type === 'official_event'
          ? draft.record_source.trim() || null
          : null,
      description: null,
      deadline_text: null,
      surface: null,
      format: null,
    })
    .select('id')
    .single()

  if (createEventError || !createdEvent) {
    throw new Error(
      `Fehler beim Erstellen von events_master: ${createEventError?.message ?? 'Unbekannt'}`
    )
  }

  return { eventMasterId: createdEvent.id, matched: false }
}
async function findOrCreateEventDistance(
  eventMasterId: number,
  parsedDistance: number
): Promise<number> {
  const { data: existingDistances, error: existingDistancesError } = await supabase
    .from('event_distances')
    .select('id, event_id, distance_km, label')
    .eq('event_id', eventMasterId)

  if (existingDistancesError) {
    throw new Error(
      `Fehler beim Laden vorhandener Distanzen: ${existingDistancesError.message}`
    )
  }

  const matchedDistance = (existingDistances as EventDistanceMatch[]).find(
    (distance) => isSameDistance(distance.distance_km, parsedDistance)
  )

  if (matchedDistance) {
    return matchedDistance.id
  }

  const { data: createdDistance, error: createDistanceError } = await supabase
    .from('event_distances')
    .insert({
      event_id: eventMasterId,
      distance_km: parsedDistance,
      label: `${parsedDistance} km`,
    })
    .select('id')
    .single()

  if (createDistanceError || !createdDistance) {
    throw new Error(
      `Fehler beim Erstellen von event_distances: ${createDistanceError?.message ?? 'Unbekannt'}`
    )
  }

  return createdDistance.id
}

function isSameDistance(a: number, b: number) {
  return Math.abs(a - b) < 0.2
}
function getCanonicalLocation(value: string | null | undefined) {
  const normalized = normalizeText(value)

  if (!normalized) return ''

  if (['alcudia', 'palma', 'mallorca'].includes(normalized)) {
    return 'mallorca'
  }

  if (['weserbergland b n', 'weserbergland'].includes(normalized)) {
    return 'weserbergland'
  }

  return normalized
}

function formatDate(dateText: string | null) {
  if (!dateText) return '—'
  return new Date(dateText).toLocaleString('de-DE')
}

function getStatusClass(status: string | null) {
  switch (status) {
    case 'approved':
      return 'border border-emerald-400/30 bg-emerald-400/12 text-emerald-200'
    case 'rejected':
      return 'border border-red-400/30 bg-red-400/12 text-red-200'
    case 'pending':
    default:
      return 'border border-yellow-400/30 bg-yellow-400/12 text-yellow-200'
  }
}

function parseTimeTextToHours(timeText: string) {
  const value = timeText.trim()
  if (!value) return null

  const parts = value.split(':').map((part) => Number(part))
  if (parts.some((part) => Number.isNaN(part))) return null

  if (parts.length === 2) {
    const [hours, minutes] = parts
    return hours + minutes / 60
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts
    return hours + minutes / 60 + seconds / 3600
  }

  return null
}

function createSubmissionDraft(
  submission: RecordSubmission
): SubmissionDraft {
  return {
    activity_name: submission.activity_name ?? '',
    description: submission.description ?? '',
    submission_type: submission.submission_type ?? '',
    activity_date: submission.activity_date ?? '',
    distance_km:
      typeof submission.distance_km === 'number'
        ? String(submission.distance_km)
        : '',
    official_distance_km:
      typeof submission.official_distance_km === 'number'
        ? String(submission.official_distance_km)
        : '',
    actual_distance_km:
      typeof submission.actual_distance_km === 'number'
        ? String(submission.actual_distance_km)
        : '',
    elapsed_time_text: submission.elapsed_time_text ?? '',
    elevation_gain:
      typeof submission.elevation_gain === 'number'
        ? String(submission.elevation_gain)
        : '',
    country: submission.country ?? '',
    location: submission.location ?? '',
    record_source: submission.record_source ?? '',
    notes: submission.notes ?? '',
    admin_note: submission.admin_note ?? '',
  }
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [claims, setClaims] = useState<ClaimRequest[]>([])
  const [recordSubmissions, setRecordSubmissions] = useState<RecordSubmission[]>(
    []
  )
  const [submissionDrafts, setSubmissionDrafts] = useState<
    Record<number, SubmissionDraft>
  >({})
  const [userEmail, setUserEmail] = useState('')
  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null)
  const [pageMessage, setPageMessage] = useState('')
  const [showResolvedClaims, setShowResolvedClaims] = useState(false)
  const [showResolvedSubmissions, setShowResolvedSubmissions] = useState(false)

  useEffect(() => {
    async function loadAdminPage() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session?.user) {
          window.location.href = '/login'
          return
        }

        setUserEmail(session.user.email ?? '')

        const { data: adminRow, error: adminError } = await supabase
          .from('admin_users')
          .select('user_id, email')
          .eq('user_id', session.user.id)
          .maybeSingle<AdminUserRow>()

        if (adminError || !adminRow) {
          setIsAdmin(false)
          setLoading(false)
          return
        }

        setIsAdmin(true)

        const [
          { data: claimRows, error: claimsError },
          { data: submissionRows, error: submissionsError },
        ] = await Promise.all([
          supabase
            .from('claim_requests')
            .select(
              'id, hiker_id, user_id, email, profile_name, message, social_link, proof_url, status, created_at, reviewed_at, admin_note'
            )
            .order('created_at', { ascending: false }),
          supabase
            .from('record_submissions')
            .select(
              'id, user_id, hiker_id, activity_name, description, submission_type, activity_date, distance_km, official_distance_km, actual_distance_km, elapsed_time_text, elevation_gain, country, location, record_source, proof_image_url, notes, status, admin_note, created_at, reviewed_at'
            )
            .order('created_at', { ascending: false }),
        ])

        if (!claimsError && claimRows) {
          setClaims(claimRows as ClaimRequest[])
        }

        if (!submissionsError && submissionRows) {
          const rows = submissionRows as RecordSubmission[]
          setRecordSubmissions(rows)

          const nextDrafts: Record<number, SubmissionDraft> = {}
          rows.forEach((row) => {
            nextDrafts[row.id] = createSubmissionDraft(row)
          })
          setSubmissionDrafts(nextDrafts)
        }
      } catch (error) {
        console.error('AdminPage load error:', error)
        setIsAdmin(false)
      } finally {
        setLoading(false)
      }
    }

    void loadAdminPage()
  }, [])

  function updateSubmissionDraft(
    id: number,
    field: keyof SubmissionDraft,
    value: string
  ) {
    setSubmissionDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }))
  }

  async function handleApproveClaim(claim: ClaimRequest) {
    setActionLoadingKey(`claim-approve-${claim.id}`)
    setPageMessage('')

    try {
      const note = window.prompt(
        'Optionaler Admin-Vermerk für die Genehmigung:',
        claim.admin_note ?? ''
      )

      const { error: hikerError } = await supabase
        .from('hikers')
        .update({
          claimed_profile: true,
          claimed_by_user_id: claim.user_id,
        })
        .eq('id', claim.hiker_id)

      if (hikerError) {
        setPageMessage(
          `Fehler beim Aktualisieren des Hiker-Profils: ${hikerError.message}`
        )
        return
      }

      const { error: claimError } = await supabase
        .from('claim_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          admin_note: note?.trim() ? note.trim() : null,
        })
        .eq('id', claim.id)

      if (claimError) {
        setPageMessage(
          `Fehler beim Aktualisieren der Claim-Anfrage: ${claimError.message}`
        )
        return
      }

      setClaims((prev) =>
        prev.map((item) =>
          item.id === claim.id
            ? {
                ...item,
                status: 'approved',
                reviewed_at: new Date().toISOString(),
                admin_note: note?.trim() ? note.trim() : null,
              }
            : item
        )
      )

      setPageMessage('Claim wurde genehmigt.')
    } catch (error: any) {
      setPageMessage(`Fehler: ${error?.message ?? 'Unbekannt'}`)
    } finally {
      setActionLoadingKey(null)
    }
  }

  async function handleRejectClaim(claim: ClaimRequest) {
    setActionLoadingKey(`claim-reject-${claim.id}`)
    setPageMessage('')

    try {
      const note = window.prompt(
        'Optionaler Admin-Vermerk für die Ablehnung:',
        claim.admin_note ?? ''
      )

      const { error: claimError } = await supabase
        .from('claim_requests')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          admin_note: note?.trim() ? note.trim() : null,
        })
        .eq('id', claim.id)

      if (claimError) {
        setPageMessage(
          `Fehler beim Aktualisieren der Claim-Anfrage: ${claimError.message}`
        )
        return
      }

      setClaims((prev) =>
        prev.map((item) =>
          item.id === claim.id
            ? {
                ...item,
                status: 'rejected',
                reviewed_at: new Date().toISOString(),
                admin_note: note?.trim() ? note.trim() : null,
              }
            : item
        )
      )

      setPageMessage('Claim wurde abgelehnt.')
    } catch (error: any) {
      setPageMessage(`Fehler: ${error?.message ?? 'Unbekannt'}`)
    } finally {
      setActionLoadingKey(null)
    }
  }

  async function handleApproveSubmission(submission: RecordSubmission) {
    const draft = submissionDrafts[submission.id]

    if (!draft) {
      setPageMessage('Kein Bearbeitungsstand für diese Einreichung gefunden.')
      return
    }

    setActionLoadingKey(`submission-approve-${submission.id}`)
    setPageMessage('')

    try {
      if (!draft.activity_date.trim() || !draft.elapsed_time_text.trim()) {
  setPageMessage('Bitte fülle vor der Freigabe alle Pflichtfelder aus.')
  return
}

if (draft.submission_type === 'official_event') {
  if (
    !draft.activity_name.trim() ||
    !draft.official_distance_km.trim() ||
    !draft.actual_distance_km.trim()
  ) {
    setPageMessage(
      'Bei offiziellen Events müssen Eventname, offizielle Distanz und gelaufene Distanz ausgefüllt sein.'
    )
    return
  }
}

if (draft.submission_type !== 'official_event') {
  if (!(draft.actual_distance_km || draft.distance_km).trim()) {
    setPageMessage('Bitte gib eine Distanz an.')
    return
  }
}

      const parsedDistance = Number(
        (draft.actual_distance_km || draft.distance_km).replace(',', '.')
      )
      let officialDistance: number | null = null

      if (draft.submission_type === 'official_event') {
        const parsedOfficial = Number(
          draft.official_distance_km.replace(',', '.')
        )

        if (!Number.isNaN(parsedOfficial) && parsedOfficial > 0) {
          officialDistance = parsedOfficial
        }
      }
      if (Number.isNaN(parsedDistance) || parsedDistance <= 0) {
        setPageMessage('Distanz ist ungültig.')
        return
      }

      const parsedElevation = draft.elevation_gain.trim()
        ? Number(draft.elevation_gain.replace(',', '.'))
        : null

      if (
        draft.elevation_gain.trim() &&
        (parsedElevation === null || Number.isNaN(parsedElevation))
      ) {
        setPageMessage('Höhenmeter sind ungültig.')
        return
      }

      const timeHours = parseTimeTextToHours(draft.elapsed_time_text)
      if (timeHours === null || timeHours <= 0) {
        setPageMessage(
          'Gesamtzeit ist ungültig. Bitte nutze z. B. 08:34 oder 08:34:12.'
        )
        return
      }

      const avgSpeed = Number((parsedDistance / timeHours).toFixed(2))

      // 1. Event finden oder erstellen
const { eventMasterId } = await findOrCreateEventMaster(draft)

// 2. Distanz finden oder erstellen
const eventDistanceId = await findOrCreateEventDistance(
  eventMasterId,
  officialDistance ?? parsedDistance
)

// 3. Record schreiben (JETZT MIT RICHTIGER ZUORDNUNG)
const { error: recordError } = await supabase.from('records').insert({
  hiker_id: submission.hiker_id,
  event_master_id: eventMasterId,
  event_distance_id: eventDistanceId,
  distance_km: parsedDistance,
  time_hours: timeHours,
  avg_speed: avgSpeed,
  activity_date: draft.activity_date,
  division: null,
  record_status: 'verified_admin_submission',
  verified: true,
  time_text: draft.elapsed_time_text.trim(),
  record_source: draft.record_source.trim() || 'user_submission',
  is_corrected: false,
  elevation_gain:
    parsedElevation !== null && !Number.isNaN(parsedElevation)
      ? parsedElevation
      : null,
})

      

     

      if (recordError) {
        setPageMessage(
          `Fehler beim Schreiben in records: ${recordError.message}`
        )
        return
      }

      const { error: submissionError } = await supabase
        .from('record_submissions')
        .update({
          activity_name:
            draft.submission_type === 'official_event'
              ? draft.activity_name.trim()
              : 'Private Wanderung',
          description:
            draft.submission_type === 'private'
              ? draft.description.trim() || null
              : null,
          submission_type: draft.submission_type || 'private',
          activity_date: draft.activity_date,
          official_distance_km: officialDistance,
          actual_distance_km: parsedDistance,
          distance_km: parsedDistance,
          elapsed_time_text: draft.elapsed_time_text.trim(),
          elevation_gain:
            parsedElevation !== null && !Number.isNaN(parsedElevation)
              ? parsedElevation
              : null,
          country: draft.country.trim().toUpperCase() || null,
          location: draft.location.trim() || null,
          record_source: draft.record_source.trim() || null,
          notes: draft.notes.trim() || null,
          admin_note: draft.admin_note.trim() || null,
          status: 'approved',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', submission.id)

      if (submissionError) {
        setPageMessage(
          `Fehler beim Aktualisieren der Einreichung: ${submissionError.message}`
        )
        return
      }

      setRecordSubmissions((prev) =>
        prev.map((item) =>
          item.id === submission.id
            ? {
                ...item,
                activity_name:
                  draft.submission_type === 'official_event'
                    ? draft.activity_name.trim()
                    : 'Private Wanderung',
                description:
                  draft.submission_type === 'private'
                    ? draft.description.trim() || null
                    : null,
                submission_type: draft.submission_type || 'private',
                activity_date: draft.activity_date,
                official_distance_km: officialDistance,
                actual_distance_km: parsedDistance,
                distance_km: parsedDistance,
                elapsed_time_text: draft.elapsed_time_text.trim(),
                elevation_gain:
                  parsedElevation !== null && !Number.isNaN(parsedElevation)
                    ? parsedElevation
                    : null,
                country: draft.country.trim().toUpperCase() || null,
                location: draft.location.trim() || null,
                record_source: draft.record_source.trim() || null,
                notes: draft.notes.trim() || null,
                admin_note: draft.admin_note.trim() || null,
                status: 'approved',
                reviewed_at: new Date().toISOString(),
              }
            : item
        )
      )

      setPageMessage('Wanderung wurde genehmigt und in records übernommen.')
    } catch (error: any) {
      setPageMessage(`Fehler: ${error?.message ?? 'Unbekannt'}`)
    } finally {
      setActionLoadingKey(null)
    }
  }

  async function handleRejectSubmission(submission: RecordSubmission) {
    const draft = submissionDrafts[submission.id]

    if (!draft) {
      setPageMessage('Kein Bearbeitungsstand für diese Einreichung gefunden.')
      return
    }

    setActionLoadingKey(`submission-reject-${submission.id}`)
    setPageMessage('')

    try {
      const { error } = await supabase
        .from('record_submissions')
        .update({
          admin_note: draft.admin_note.trim() || null,
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', submission.id)

      if (error) {
        setPageMessage(`Fehler beim Ablehnen der Einreichung: ${error.message}`)
        return
      }

      setRecordSubmissions((prev) =>
        prev.map((item) =>
          item.id === submission.id
            ? {
                ...item,
                admin_note: draft.admin_note.trim() || null,
                status: 'rejected',
                reviewed_at: new Date().toISOString(),
              }
            : item
        )
      )

      setPageMessage('Wanderung wurde abgelehnt.')
    } catch (error: any) {
      setPageMessage(`Fehler: ${error?.message ?? 'Unbekannt'}`)
    } finally {
      setActionLoadingKey(null)
    }
  }

  const pendingClaims = useMemo(
    () => claims.filter((claim) => claim.status === 'pending'),
    [claims]
  )
  const approvedClaims = useMemo(
    () => claims.filter((claim) => claim.status === 'approved'),
    [claims]
  )
  const rejectedClaims = useMemo(
    () => claims.filter((claim) => claim.status === 'rejected'),
    [claims]
  )
  const resolvedClaims = useMemo(
    () => claims.filter((claim) => claim.status !== 'pending'),
    [claims]
  )

  const pendingSubmissions = useMemo(
    () =>
      recordSubmissions.filter((submission) => submission.status === 'pending'),
    [recordSubmissions]
  )
  const resolvedSubmissions = useMemo(
    () =>
      recordSubmissions.filter((submission) => submission.status !== 'pending'),
    [recordSubmissions]
  )

  if (loading) {
    return (
      <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
        <div className="mx-auto max-w-6xl">
          <ProfileBrandBar />

          <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-xl shadow-black/10">
            <h1 className="text-2xl font-bold text-white">
              Admin-Bereich wird geladen…
            </h1>
            <p className="mt-3 text-stone-400">Einen Moment bitte.</p>
          </div>
        </div>
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
        <div className="mx-auto max-w-6xl">
          <ProfileBrandBar />

          <Link
            href="/"
            className="text-sm text-stone-400 transition hover:text-white"
          >
            ← Zurück zur Startseite
          </Link>

          <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-xl shadow-black/10">
            <h1 className="text-2xl font-bold text-white">Kein Zugriff</h1>
            <p className="mt-3 text-stone-400">
              Dieser Bereich ist nur für Admins verfügbar.
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
      <div className="mx-auto max-w-6xl">
        <ProfileBrandBar />

        <Link
          href="/"
          className="text-sm text-stone-400 transition hover:text-white"
        >
          ← Zurück zur Startseite
        </Link>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.03] p-6 shadow-2xl shadow-black/20 backdrop-blur-sm md:p-8">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-stone-400">
              Admin-Bereich
            </div>

            <h1 className="mt-2 text-4xl font-bold tracking-tight text-white md:text-5xl">
              Moderation
            </h1>

            <p className="mt-4 text-sm text-stone-400">
              Eingeloggt als{' '}
              <span className="font-semibold text-stone-200">{userEmail}</span>
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                Claims offen
              </div>
              <div className="mt-2 text-2xl font-bold text-white">
                {pendingClaims.length}
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                Claims genehmigt
              </div>
              <div className="mt-2 text-2xl font-bold text-white">
                {approvedClaims.length}
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                Claims abgelehnt
              </div>
              <div className="mt-2 text-2xl font-bold text-white">
                {rejectedClaims.length}
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                Records offen
              </div>
              <div className="mt-2 text-2xl font-bold text-white">
                {pendingSubmissions.length}
              </div>
            </div>
          </div>

          {pageMessage ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-stone-200">
              {pageMessage}
            </div>
          ) : null}
        </section>

        <section className="mt-10">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">
                Offene Claim-Anfragen
              </h2>
              <p className="mt-1 text-sm text-stone-400">
                Hier stehen nur noch Claims, die aktuell bearbeitet werden müssen.
              </p>
            </div>

            <div className="hidden text-xs uppercase tracking-[0.2em] text-stone-500 md:block">
              Offen
            </div>
          </div>

          <div className="space-y-4">
            {pendingClaims.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-stone-400">
                Aktuell keine offenen Claim-Anfragen.
              </div>
            ) : (
              pendingClaims.map((claim) => (
                <div
                  key={claim.id}
                  className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/10"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-stone-500">
                        Anfrage vom {formatDate(claim.created_at)}
                      </div>

                      <div className="mt-1 text-xl font-semibold text-white">
                        {claim.profile_name ?? 'Unbekanntes Profil'}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-stone-400">
                        <span>E-Mail: {claim.email ?? '—'}</span>
                        <span>·</span>
                        <span>Hiker-ID: {claim.hiker_id}</span>
                      </div>
                    </div>

                    <div
                      className={`inline-flex rounded-full px-3 py-1 text-xs ${getStatusClass(
                        claim.status
                      )}`}
                    >
                      {claim.status ?? 'pending'}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                        Begründung
                      </div>
                      <div className="mt-2 text-sm leading-6 text-stone-200">
                        {claim.message ?? '—'}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                        Nachweis
                      </div>

                      <div className="mt-2 text-sm text-stone-200">
                        {claim.proof_url ? (
                          <a
                            href={claim.proof_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-white underline underline-offset-4 transition hover:text-stone-300"
                          >
                            Nachweis öffnen
                          </a>
                        ) : (
                          '—'
                        )}
                      </div>

                      {claim.social_link ? (
                        <div className="mt-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                            Social Link
                          </div>
                          <a
                            href={claim.social_link}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-block text-sm font-medium text-white underline underline-offset-4 transition hover:text-stone-300"
                          >
                            Social Profil öffnen
                          </a>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {(claim.admin_note || claim.reviewed_at) && (
                    <div className="mt-4 rounded-2xl border border-white/8 bg-black/10 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                        Review-Vermerk
                      </div>

                      <div className="mt-2 text-sm text-stone-200">
                        {claim.admin_note ?? 'Kein Vermerk'}
                      </div>

                      <div className="mt-2 text-xs text-stone-500">
                        Reviewed: {formatDate(claim.reviewed_at)}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => handleApproveClaim(claim)}
                      disabled={actionLoadingKey === `claim-approve-${claim.id}`}
                      className="rounded-2xl border border-emerald-400/30 bg-emerald-400/12 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-400/18 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {actionLoadingKey === `claim-approve-${claim.id}`
                        ? 'Wird verarbeitet…'
                        : 'Genehmigen'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRejectClaim(claim)}
                      disabled={actionLoadingKey === `claim-reject-${claim.id}`}
                      className="rounded-2xl border border-red-400/30 bg-red-400/12 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-400/18 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {actionLoadingKey === `claim-reject-${claim.id}`
                        ? 'Wird verarbeitet…'
                        : 'Ablehnen'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-12">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">
                Offene Wanderungs-Einreichungen
              </h2>
              <p className="mt-1 text-sm text-stone-400">
                Neue Einreichungen prüfen, anpassen und dann freigeben.
              </p>
            </div>

            <div className="hidden text-xs uppercase tracking-[0.2em] text-stone-500 md:block">
              Offen
            </div>
          </div>

          <div className="space-y-4">
            {pendingSubmissions.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-stone-400">
                Aktuell keine offenen Wanderungs-Einreichungen.
              </div>
            ) : (
              pendingSubmissions.map((submission) => {
                const draft =
                  submissionDrafts[submission.id] ??
                  createSubmissionDraft(submission)

                return (
                  <div
                    key={submission.id}
                    className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/10"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-stone-500">
                          Eingereicht am {formatDate(submission.created_at)}
                        </div>

                        <div className="mt-1 text-xl font-semibold text-white">
                          {submission.submission_type === 'official_event'
                            ? submission.activity_name
                            : submission.description || 'Private Wanderung'}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-stone-400">
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1">
                            {submission.submission_type === 'official_event'
                              ? 'Offizielles Event'
                              : 'Private Wanderung'}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-stone-400">
                          <span>Hiker-ID: {submission.hiker_id ?? '—'}</span>
                          <span>·</span>
                          <span>User-ID: {submission.user_id}</span>
                        </div>
                      </div>

                      <div
                        className={`inline-flex rounded-full px-3 py-1 text-xs ${getStatusClass(
                          submission.status
                        )}`}
                      >
                        {submission.status ?? 'pending'}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                        <div className="mb-3 text-xs uppercase tracking-[0.18em] text-stone-500">
                          Bearbeitbare Daten
                        </div>

                        <div className="space-y-3">
                          {submission.submission_type === 'official_event' ? (
                            <div>
                              <label className="mb-2 block text-sm text-stone-300">
                                Name des offiziellen Events
                              </label>
                              <input
                                type="text"
                                value={draft.activity_name}
                                onChange={(e) =>
                                  updateSubmissionDraft(
                                    submission.id,
                                    'activity_name',
                                    e.target.value
                                  )
                                }
                                className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                              />
                            </div>
                          ) : (
                            <div>
                              <label className="mb-2 block text-sm text-stone-300">
                                Beschreibung
                              </label>
                              <input
                                type="text"
                                value={draft.description}
                                onChange={(e) =>
                                  updateSubmissionDraft(
                                    submission.id,
                                    'description',
                                    e.target.value
                                  )
                                }
                                className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                              />
                            </div>
                          )}

                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-sm text-stone-300">
                                Datum
                              </label>
                              <input
                                type="date"
                                value={draft.activity_date}
                                onChange={(e) =>
                                  updateSubmissionDraft(
                                    submission.id,
                                    'activity_date',
                                    e.target.value
                                  )
                                }
                                className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                              />
                            </div>

                            {submission.submission_type === 'official_event' ? (
                              <div className="grid gap-3 md:grid-cols-2">
                                <div>
                                  <label className="mb-2 block text-sm text-stone-300">
                                    Offizielle Distanz
                                  </label>
                                  <input
                                    type="text"
                                    value={draft.official_distance_km}
                                    onChange={(e) =>
                                      updateSubmissionDraft(
                                        submission.id,
                                        'official_distance_km',
                                        e.target.value
                                      )
                                    }
                                    className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                                  />
                                </div>

                                <div>
                                  <label className="mb-2 block text-sm text-stone-300">
                                    Gelaufene Distanz
                                  </label>
                                  <input
                                    type="text"
                                    value={draft.actual_distance_km}
                                    onChange={(e) =>
                                      updateSubmissionDraft(
                                        submission.id,
                                        'actual_distance_km',
                                        e.target.value
                                      )
                                    }
                                    className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div>
                                <label className="mb-2 block text-sm text-stone-300">
                                  Distanz
                                </label>
                                <input
                                  type="text"
                                  value={draft.actual_distance_km}
                                  onChange={(e) =>
                                    updateSubmissionDraft(
                                      submission.id,
                                      'actual_distance_km',
                                      e.target.value
                                    )
                                  }
                                  className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                                />
                              </div>
                            )}
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-sm text-stone-300">
                                Gesamtzeit
                              </label>
                              <input
                                type="text"
                                value={draft.elapsed_time_text}
                                onChange={(e) =>
                                  updateSubmissionDraft(
                                    submission.id,
                                    'elapsed_time_text',
                                    e.target.value
                                  )
                                }
                                className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-sm text-stone-300">
                                Höhenmeter
                              </label>
                              <input
                                type="text"
                                value={draft.elevation_gain}
                                onChange={(e) =>
                                  updateSubmissionDraft(
                                    submission.id,
                                    'elevation_gain',
                                    e.target.value
                                  )
                                }
                                className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                              />
                            </div>
                          </div>

                          <div className="grid gap-3 md:grid-cols-3">
                            <div>
                              <label className="mb-2 block text-sm text-stone-300">
                                Land
                              </label>
                              <input
                                type="text"
                                value={draft.country}
                                onChange={(e) =>
                                  updateSubmissionDraft(
                                    submission.id,
                                    'country',
                                    e.target.value
                                  )
                                }
                                className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-sm text-stone-300">
                                Ort
                              </label>
                              <input
                                type="text"
                                value={draft.location}
                                onChange={(e) =>
                                  updateSubmissionDraft(
                                    submission.id,
                                    'location',
                                    e.target.value
                                  )
                                }
                                className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-sm text-stone-300">
                                Veranstalter
                              </label>
                              <input
                                type="text"
                                value={draft.record_source}
                                onChange={(e) =>
                                  updateSubmissionDraft(
                                    submission.id,
                                    'record_source',
                                    e.target.value
                                  )
                                }
                                placeholder="z. B. Ultramarsch"
                                className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="mb-2 block text-sm text-stone-300">
                              User-Notiz
                            </label>
                            <textarea
                              value={draft.notes}
                              onChange={(e) =>
                                updateSubmissionDraft(
                                  submission.id,
                                  'notes',
                                  e.target.value
                                )
                              }
                              rows={3}
                              className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm text-stone-300">
                              Admin-Notiz
                            </label>
                            <textarea
                              value={draft.admin_note}
                              onChange={(e) =>
                                updateSubmissionDraft(
                                  submission.id,
                                  'admin_note',
                                  e.target.value
                                )
                              }
                              rows={3}
                              className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                          Nachweis
                        </div>

                        <div className="mt-3">
                          <a
                            href={submission.proof_image_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block text-sm font-medium text-white underline underline-offset-4 transition hover:text-stone-300"
                          >
                            Nachweis öffnen
                          </a>
                        </div>

                        {(draft.admin_note || submission.reviewed_at) && (
                          <div className="mt-6 rounded-2xl border border-white/8 bg-black/10 p-4">
                            <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                              Review-Vermerk
                            </div>

                            <div className="mt-2 text-sm text-stone-200">
                              {draft.admin_note || 'Kein Vermerk'}
                            </div>

                            <div className="mt-2 text-xs text-stone-500">
                              Reviewed: {formatDate(submission.reviewed_at)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => handleApproveSubmission(submission)}
                        disabled={
                          actionLoadingKey ===
                          `submission-approve-${submission.id}`
                        }
                        className="rounded-2xl border border-emerald-400/30 bg-emerald-400/12 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-400/18 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {actionLoadingKey ===
                        `submission-approve-${submission.id}`
                          ? 'Wird verarbeitet…'
                          : 'Anpassen & genehmigen'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRejectSubmission(submission)}
                        disabled={
                          actionLoadingKey ===
                          `submission-reject-${submission.id}`
                        }
                        className="rounded-2xl border border-red-400/30 bg-red-400/12 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-400/18 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {actionLoadingKey ===
                        `submission-reject-${submission.id}`
                          ? 'Wird verarbeitet…'
                          : 'Ablehnen'}
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>

        <section className="mt-12">
          <button
            type="button"
            onClick={() => setShowResolvedClaims((prev) => !prev)}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-stone-200 transition hover:bg-white/[0.06]"
          >
            {showResolvedClaims
              ? `Bearbeitete Claims ausblenden (${resolvedClaims.length})`
              : `Bearbeitete Claims anzeigen (${resolvedClaims.length})`}
          </button>

          {showResolvedClaims ? (
            <div className="mt-4 space-y-3">
              {resolvedClaims.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-stone-400">
                  Keine bearbeiteten Claims vorhanden.
                </div>
              ) : (
                resolvedClaims.map((claim) => (
                  <div
                    key={claim.id}
                    className="rounded-2xl border border-white/10 bg-black/10 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white">
                          {claim.profile_name ?? 'Unbekanntes Profil'}
                        </div>
                        <div className="mt-1 text-xs text-stone-500">
                          {claim.email ?? '—'} · Hiker-ID {claim.hiker_id} ·{' '}
                          {formatDate(claim.reviewed_at ?? claim.created_at)}
                        </div>
                      </div>

                      <div
                        className={`inline-flex rounded-full px-3 py-1 text-xs ${getStatusClass(
                          claim.status
                        )}`}
                      >
                        {claim.status ?? '—'}
                      </div>
                    </div>

                    {claim.admin_note ? (
                      <div className="mt-3 text-sm text-stone-300">
                        {claim.admin_note}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          ) : null}
        </section>

        <section className="mt-8">
          <button
            type="button"
            onClick={() => setShowResolvedSubmissions((prev) => !prev)}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-stone-200 transition hover:bg-white/[0.06]"
          >
            {showResolvedSubmissions
              ? `Bearbeitete Einreichungen ausblenden (${resolvedSubmissions.length})`
              : `Bearbeitete Einreichungen anzeigen (${resolvedSubmissions.length})`}
          </button>

          {showResolvedSubmissions ? (
            <div className="mt-4 space-y-3">
              {resolvedSubmissions.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-stone-400">
                  Keine bearbeiteten Einreichungen vorhanden.
                </div>
              ) : (
                resolvedSubmissions.map((submission) => (
                  <div
                    key={submission.id}
                    className="rounded-2xl border border-white/10 bg-black/10 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white">
                          {submission.activity_name}
                        </div>
                        <div className="mt-1 text-xs text-stone-500">
                          Hiker-ID {submission.hiker_id ?? '—'} ·{' '}
                          {formatDate(submission.reviewed_at ?? submission.created_at)}
                        </div>
                      </div>

                      <div
                        className={`inline-flex rounded-full px-3 py-1 text-xs ${getStatusClass(
                          submission.status
                        )}`}
                      >
                        {submission.status ?? '—'}
                      </div>
                    </div>

                    {submission.admin_note ? (
                      <div className="mt-3 text-sm text-stone-300">
                        {submission.admin_note}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  )
}