'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import ProfileBrandBar from '../components/ProfileBrandBar'
import RecordSubmissionPanel from '../components/RecordSubmissionPanel'
import BackToHomeButton from '../components/BackToHomeButton'
import RecordEditRequestForm from '../components/RecordEditRequestForm'

type Hiker = {
  id: number
  display_name: string | null
  country: string | null
  gender: string | null
  total_km: number | null
  avg_speed: number | null
  division: 'silver' | 'gold' | 'platinum' | null
  claimed_profile: boolean | null
  profile_image: string | null
}

type RawRecord = {
  id: number
  event_id: number | null
  event_master_id: number | null
  event_distance_id: number | null
  distance_km: number | null
  time_hours: number | null
  avg_speed: number | null
  activity_date: string | null
  division: string | null
  record_status: string | null
  verified: boolean | null
  time_text: string | null
  record_source: string | null
  is_corrected: boolean | null
  elevation_gain: number | null
  custom_title?: string | null
  custom_location?: string | null
  custom_country?: string | null
}

type EventItem = {
  id: number
  title: string | null
  city: string | null
  country: string | null
  country_code: string | null
}

type EventDistanceItem = {
  id: number
  distance_km: number | null
}

type RecordItem = {
  id: number
  distance_km: number | null
  time_hours: number | null
  avg_speed: number | null
  activity_date: string | null
  division: string | null
  record_status: string | null
  verified: boolean | null
  time_text: string | null
  record_source: string | null
  is_corrected: boolean | null
  elevation_gain: number | null
  event_name: string
  location: string
  country: string
  country_code: string | null
  event_master_id: number | null
  official_distance_km: number | null
  actual_distance_km: number | null
}



type UserState = {
  email: string
}

type ClaimRequest = {
  id: number
  hiker_id: number
  profile_name: string | null
  status: string | null
  created_at: string | null
  reviewed_at: string | null
  admin_note: string | null
}

type RejectedSubmissionNotice = {
  id: number
  activity_name: string | null
  admin_note: string | null
  reviewed_at: string | null
}

type RejectedCorrectionNotice = {
  id: number
  activity_name: string | null
  admin_note: string | null
  reviewed_at: string | null
}

const SKYSCRAPER_THRESHOLD = 1500

const COUNTRY_OPTIONS = [
  { value: 'DE', label: 'Deutschland' },
  { value: 'AT', label: 'Österreich' },
  { value: 'CH', label: 'Schweiz' },

  { value: 'FR', label: 'Frankreich' },
  { value: 'IT', label: 'Italien' },
  { value: 'ES', label: 'Spanien' },
  { value: 'PT', label: 'Portugal' },
  { value: 'NL', label: 'Niederlande' },
  { value: 'BE', label: 'Belgien' },
  { value: 'LU', label: 'Luxemburg' },
  { value: 'DK', label: 'Dänemark' },
  { value: 'SE', label: 'Schweden' },
  { value: 'NO', label: 'Norwegen' },
  { value: 'FI', label: 'Finnland' },
  { value: 'IS', label: 'Island' },
  { value: 'IE', label: 'Irland' },
  { value: 'GB', label: 'Vereinigtes Königreich' },

  { value: 'PL', label: 'Polen' },
  { value: 'CZ', label: 'Tschechien' },
  { value: 'SK', label: 'Slowakei' },
  { value: 'HU', label: 'Ungarn' },
  { value: 'SI', label: 'Slowenien' },
  { value: 'HR', label: 'Kroatien' },
  { value: 'BA', label: 'Bosnien und Herzegowina' },
  { value: 'RS', label: 'Serbien' },
  { value: 'ME', label: 'Montenegro' },
  { value: 'MK', label: 'Nordmazedonien' },
  { value: 'AL', label: 'Albanien' },

  { value: 'RO', label: 'Rumänien' },
  { value: 'BG', label: 'Bulgarien' },
  { value: 'GR', label: 'Griechenland' },

  { value: 'EE', label: 'Estland' },
  { value: 'LV', label: 'Lettland' },
  { value: 'LT', label: 'Litauen' },

  { value: 'UA', label: 'Ukraine' },
  { value: 'RU', label: 'Russland' },
  { value: 'TR', label: 'Türkei' },
]

const GENDER_OPTIONS = [
  { value: 'W', label: 'Weiblich' },
  { value: 'M', label: 'Männlich' },
  { value: 'D', label: 'Divers' },
]

function countryToFlag(countryCode: string | null) {
  if (!countryCode) return '—'
  const code = countryCode.trim().toUpperCase()
  if (code.length !== 2) return '—'
  return String.fromCodePoint(
    ...[...code].map((char) => 127397 + char.charCodeAt(0))
  )
}

function getCountryLabel(countryCode: string | null) {
  if (!countryCode) return '—'
  return (
    COUNTRY_OPTIONS.find((option) => option.value === countryCode)?.label ??
    countryCode
  )
}

function getGenderLabel(gender: string | null) {
  if (!gender) return '—'
  return (
    GENDER_OPTIONS.find((option) => option.value === gender)?.label ?? gender
  )
}

function getDivisionBadgeClass(division: string | null) {
  switch (division) {
    case 'platinum':
      return 'border border-fuchsia-400/30 bg-fuchsia-400/12 text-fuchsia-200'
    case 'gold':
      return 'border border-yellow-400/30 bg-yellow-400/12 text-yellow-200'
    case 'silver':
    default:
      return 'border border-stone-300/25 bg-stone-300/10 text-stone-100'
  }
}

function getVerifiedClass(verified: boolean | null) {
  if (verified) {
    return 'border border-emerald-400/30 bg-emerald-400/12 text-emerald-200'
  }

  return 'border border-stone-300/25 bg-stone-300/10 text-stone-200'
}

function getClaimStatusClass(status: string | null) {
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

function formatClaimStatus(status: string | null) {
  switch (status) {
    case 'approved':
      return 'Genehmigt'
    case 'rejected':
      return 'Abgelehnt'
    case 'pending':
    default:
      return 'Offen'
  }
}

function getDivisionGlow(division: string | null) {
  switch (division) {
    case 'platinum':
      return 'border-fuchsia-400/40 bg-fuchsia-400/[0.06] shadow-[0_0_28px_rgba(217,70,239,0.22)]'
    case 'gold':
      return 'border-yellow-400/40 bg-yellow-400/[0.05] shadow-[0_0_28px_rgba(250,204,21,0.18)]'
    case 'silver':
    default:
      return 'border-stone-300/20 bg-black/10 shadow-[0_0_16px_rgba(255,255,255,0.04)]'
  }
}

function StatCard({
  label,
  value,
  division,
}: {
  label: string
  value: string
  division: string | null
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-4 backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:scale-[1.01] ${getDivisionGlow(
        division
      )}`}
    >
      <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
    </div>
  )
}

function formatTime(timeText: string | null, timeHours: number | null) {
  if (timeText && timeText.trim().length > 0) return timeText

  if (timeHours === null || timeHours === undefined) return '—'

  const totalMinutes = Math.round(timeHours * 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return `${hours}:${minutes.toString().padStart(2, '0')}`
}

function formatDate(date: string | null) {
  if (!date) return '—'
  const [year, month, day] = date.split('-')
  if (!year || !month || !day) return date
  return `${day}.${month}.${year}`
}

function getRecordStatusLabel(status: string | null) {
  switch (status) {
    case 'verified_admin_submission':
      return 'verified'
    case 'verified_elapsed':
      return 'Verifiziert'
    case 'user_submission':
      return 'In Prüfung'
    default:
      return status ?? '—'
  }
}

const REJECTION_NOTICE_START_DATE = '2026-04-08'



export default function AccountPage() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<UserState | null>(null)
  const [hiker, setHiker] = useState<Hiker | null>(null)
  const [records, setRecords] = useState<RecordItem[]>([])
  const [claimRequests, setClaimRequests] = useState<ClaimRequest[]>([])
  const [rejectedSubmissionNotices, setRejectedSubmissionNotices] = useState<RejectedSubmissionNotice[]>([])
  const [rejectedCorrectionNotices, setRejectedCorrectionNotices] = useState<RejectedCorrectionNotice[]>([])
  const [dismissedSubmissionNoticeIds, setDismissedSubmissionNoticeIds] = useState<number[]>([])
  const [dismissedCorrectionNoticeIds, setDismissedCorrectionNoticeIds] = useState<number[]>([])
  const [overallRank, setOverallRank] = useState<number | null>(null)
  const [divisionRank, setDivisionRank] = useState<number | null>(null)
  const [totalElevation, setTotalElevation] = useState<number>(0)
  const [hasSkyscraper, setHasSkyscraper] = useState(false)
  const [skyscraperRank, setSkyscraperRank] = useState<number | null>(null)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [profileCountry, setProfileCountry] = useState('')
  const [profileGender, setProfileGender] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaveMessage, setProfileSaveMessage] = useState('')
  const [profileSaveError, setProfileSaveError] = useState('')
  const [showProfileMetaForm, setShowProfileMetaForm] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          window.location.href = '/login'
          return
        }

        setUser({
          email: session.user.email ?? 'Unbekannt',
        })

        const { data: claimRows } = await supabase
          .from('claim_requests')
          .select(
            'id, hiker_id, profile_name, status, created_at, reviewed_at, admin_note'
          )
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })

        setClaimRequests((claimRows as ClaimRequest[]) ?? [])

        const { data: rejectedSubmissionRows } = await supabase
          .from('record_submissions')
          .select('id, activity_name, admin_note, reviewed_at')
          .eq('user_id', session.user.id)
          .eq('status', 'rejected')
          .gte('reviewed_at', `${REJECTION_NOTICE_START_DATE}T00:00:00`)
          .order('reviewed_at', { ascending: false })

        setRejectedSubmissionNotices(
          (rejectedSubmissionRows as RejectedSubmissionNotice[]) ?? []
        )

        const { data: rejectedCorrectionRows } = await supabase
          .from('record_corrections')
          .select('id, activity_name, admin_note, reviewed_at')
          .eq('user_id', session.user.id)
          .eq('status', 'rejected')
          .gte('reviewed_at', `${REJECTION_NOTICE_START_DATE}T00:00:00`)
          .order('reviewed_at', { ascending: false })

        setRejectedCorrectionNotices(
          (rejectedCorrectionRows as RejectedCorrectionNotice[]) ?? []
        )

        const { data: hikerRows, error: hikerError } = await supabase
          .from('hikers')
          .select(
            'id, display_name, country, gender, total_km, avg_speed, division, claimed_profile, profile_image'
          )
          .eq('claimed_by_user_id', session.user.id)
          .limit(1)

        if (hikerError || !hikerRows || hikerRows.length === 0) {
          setLoading(false)
          return
        }

        const currentHiker = hikerRows[0] as Hiker
        setHiker(currentHiker)
        setProfileCountry(currentHiker.country ?? '')
        setProfileGender(currentHiker.gender ?? '')
        setShowProfileMetaForm(!currentHiker.country || !currentHiker.gender)

        const currentTotalKm =
          typeof currentHiker.total_km === 'number' ? currentHiker.total_km : 0

        const { count: overallHigherCount, error: overallRankError } = await supabase
          .from('hikers')
          .select('*', { count: 'exact', head: true })
          .gt('total_km', currentTotalKm)

        if (overallRankError) {
          setOverallRank(null)
        } else {
          setOverallRank((overallHigherCount ?? 0) + 1)
        }

        if (currentHiker.division) {
          const { count: divisionHigherCount, error: divisionRankError } = await supabase
            .from('hikers')
            .select('*', { count: 'exact', head: true })
            .eq('division', currentHiker.division)
            .gt('total_km', currentTotalKm)

          if (divisionRankError) {
            setDivisionRank(null)
          } else {
            setDivisionRank((divisionHigherCount ?? 0) + 1)
          }
        } else {
          setDivisionRank(null)
        }

        const { data: recordRows, error: recordsError } = await supabase
          .from('records')
          .select(
            'id, event_id, event_master_id, event_distance_id, distance_km, time_hours, avg_speed, activity_date, division, record_status, verified, time_text, record_source, is_corrected, elevation_gain, custom_title, custom_location, custom_country'
          )
          .eq('hiker_id', currentHiker.id)
          .order('activity_date', { ascending: false })

        if (recordsError || !recordRows || recordRows.length === 0) {
          setRecords([])
          setTotalElevation(0)
          setHasSkyscraper(false)
          setLoading(false)
          return
        }

        const rawRecords = recordRows as RawRecord[]

       const totalElevationValue = rawRecords.reduce((sum, record) => {
          return (
            sum +
            (typeof record.elevation_gain === 'number'
              ? record.elevation_gain
              : 0)
          )
        }, 0)

        setTotalElevation(totalElevationValue)
        setHasSkyscraper(totalElevationValue >= SKYSCRAPER_THRESHOLD)

        const { data: elevationRows, error: elevationError } = await supabase
          .from('records')
          .select('hiker_id, elevation_gain')

        if (elevationError || !elevationRows) {
          setSkyscraperRank(null)
        } else {
          const elevationMap = new Map<number, number>()

          elevationRows.forEach((row: any) => {
            if (typeof row.hiker_id !== 'number') return

            const current = elevationMap.get(row.hiker_id) ?? 0
            const nextGain =
              typeof row.elevation_gain === 'number' ? row.elevation_gain : 0

            elevationMap.set(row.hiker_id, current + nextGain)
          })

          const skyscraperRanking = Array.from(elevationMap.entries())
            .map(([id, elevation]) => ({ id, elevation }))
            .filter((entry) => entry.elevation >= SKYSCRAPER_THRESHOLD)
            .sort((a, b) => b.elevation - a.elevation)

          const index = skyscraperRanking.findIndex(
            (entry) => entry.id === currentHiker.id
          )

          setSkyscraperRank(index >= 0 ? index + 1 : null)
        } 

        const eventMasterIds = Array.from(
          new Set(
            rawRecords
              .map((record) => record.event_master_id)
              .filter((eventId): eventId is number => typeof eventId === 'number')
          )
        )

        let eventsMap = new Map<number, EventItem>()
        let eventDistancesMap = new Map<number, EventDistanceItem>()

        if (eventMasterIds.length > 0) {
          const { data: eventRows } = await supabase
            .from('events_master')
            .select('id, title, city, country, country_code')
            .in('id', eventMasterIds)

          if (eventRows) {
            eventsMap = new Map(
              (eventRows as EventItem[]).map((event) => [event.id, event])
            )
          }

          const eventDistanceIds = Array.from(
            new Set(
              rawRecords
                .map((record) => record.event_distance_id)
                .filter((id): id is number => typeof id === 'number')
            )
          )

          if (eventDistanceIds.length > 0) {
            const { data: eventDistanceRows } = await supabase
              .from('event_distances')
              .select('id, distance_km')
              .in('id', eventDistanceIds)

            if (eventDistanceRows) {
              eventDistancesMap = new Map(
                (eventDistanceRows as EventDistanceItem[]).map((row) => [row.id, row])
              )
            }
          }
        }

        const mergedRecords: RecordItem[] = rawRecords.map((record) => {
          const event = record.event_master_id
            ? eventsMap.get(record.event_master_id)
            : null

          const eventDistance =
            record.event_distance_id != null
              ? eventDistancesMap.get(record.event_distance_id)
              : null

          return {
            ...record,
            event_master_id: record.event_master_id,
            event_name: event?.title ?? record.custom_title ?? 'Privater Eintrag',
            location: event?.city ?? record.custom_location ?? '—',
            country: event?.country ?? record.custom_country ?? '—',
            country_code: event?.country_code ?? null,
            official_distance_km: event ? eventDistance?.distance_km ?? null : null,
            actual_distance_km: record.distance_km ?? null,
          }
        })

        setRecords(mergedRecords)
      } catch (error) {
        console.error('AccountPage loadData error:', error)
        setOverallRank(null)
        setDivisionRank(null)
        setTotalElevation(0)
        setHasSkyscraper(false)
        setSkyscraperRank(null)
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [])

  useEffect(() => {
  try {
    const storedSubmissionIds = window.localStorage.getItem(
      'dismissedRejectedSubmissionNoticeIds'
    )
    const storedCorrectionIds = window.localStorage.getItem(
      'dismissedRejectedCorrectionNoticeIds'
    )

    if (storedSubmissionIds) {
      const parsed = JSON.parse(storedSubmissionIds)
      if (Array.isArray(parsed)) {
        setDismissedSubmissionNoticeIds(
          parsed.filter((value) => typeof value === 'number')
        )
      }
    }

    if (storedCorrectionIds) {
      const parsed = JSON.parse(storedCorrectionIds)
      if (Array.isArray(parsed)) {
        setDismissedCorrectionNoticeIds(
          parsed.filter((value) => typeof value === 'number')
        )
      }
    }
  } catch (error) {
    console.error('Failed to load dismissed admin notices from localStorage', error)
  }
}, [])

  async function handleProfileImageUpload(file: File) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session || !hiker) return

      const fileExt = file.name.split('.').pop()
      const filePath = `profile-${hiker.id}-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('claim-proofs')
        .upload(filePath, file)

      if (uploadError) {
        console.error('Upload error:', uploadError)
        alert('Upload fehlgeschlagen')
        return
      }

      const { data } = supabase.storage
        .from('claim-proofs')
        .getPublicUrl(filePath)

      const publicUrl = data.publicUrl

      const { error: updateError } = await supabase
        .from('hikers')
        .update({ profile_image: publicUrl })
        .eq('id', hiker.id)

      if (updateError) {
        console.error('DB update error:', updateError)
        alert('Speichern fehlgeschlagen')
        return
      }

      setHiker((prev) =>
        prev ? { ...prev, profile_image: publicUrl } : prev
      )
    } catch (err) {
      console.error(err)
      alert('Fehler beim Upload')
    }
  }

  async function handleSaveProfileMeta() {
    if (!hiker) return

    setProfileSaving(true)
    setProfileSaveMessage('')
    setProfileSaveError('')

    try {
      const nextCountry = profileCountry || null
      const nextGender = profileGender || null

      const { error } = await supabase
        .from('hikers')
        .update({
          country: nextCountry,
          gender: nextGender,
        })
        .eq('id', hiker.id)

      if (error) {
        setProfileSaveError(error.message)
        return
      }

      setHiker((prev) =>
        prev
          ? {
              ...prev,
              country: nextCountry,
              gender: nextGender,
            }
          : prev
      )

      setProfileSaveMessage('Profilangaben wurden gespeichert.')
      setShowProfileMetaForm(false)
    } catch (error: any) {
      setProfileSaveError(error?.message ?? 'Unbekannter Fehler')
    } finally {
      setProfileSaving(false)
    }
  }

  function dismissSubmissionNotice(id: number) {
    const updated = [...dismissedSubmissionNoticeIds, id]

    setDismissedSubmissionNoticeIds(updated)

    try {
      window.localStorage.setItem(
        'dismissedRejectedSubmissionNoticeIds',
        JSON.stringify(updated)
      )
    } catch (error) {
      console.error('Failed to store dismissed submission notice', error)
    }
  }

  function dismissCorrectionNotice(id: number) {
    const updated = [...dismissedCorrectionNoticeIds, id]

    setDismissedCorrectionNoticeIds(updated)

    try {
      window.localStorage.setItem(
        'dismissedRejectedCorrectionNoticeIds',
        JSON.stringify(updated)
      )
    } catch (error) {
      console.error('Failed to store dismissed correction notice', error)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  async function handleCreateHiker() {
    if (!newName.trim()) return

    setCreating(true)
    setCreateError('')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        setCreateError('Keine aktive Session gefunden.')
        return
      }

      const { error } = await supabase.from('hikers').insert({
        display_name: newName.trim(),
        claimed_profile: true,
        claimed_by_user_id: session.user.id,
        division: 'silver',
        total_km: 0,
        avg_speed: null,
        country: null,
        gender: null,
      })

      if (error) {
        setCreateError(error.message)
        return
      }

      window.location.reload()
    } catch (error: any) {
      setCreateError(error?.message ?? 'Unbekannter Fehler')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-xl shadow-black/10 backdrop-blur-sm">
          <h1 className="text-2xl font-bold text-white">
            Liga-Profil wird geladen…
          </h1>
          <p className="mt-3 text-stone-400">Einen Moment bitte.</p>
        </div>
      </main>
    )
  }

  if (!hiker) {
    return (
      <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
        <div className="mx-auto max-w-xl">
          <BackToHomeButton />

          <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-xl shadow-black/10 backdrop-blur-sm">
            <h1 className="text-2xl font-bold text-white">Profil erstellen</h1>
            <p className="mt-3 text-stone-400">
              Bitte gib deinen bürgerlichen Namen ein, um dein Profil anzulegen.
            </p>

            <div className="mt-6">
              <label className="mb-2 block text-sm font-medium text-stone-300">
                Bürgerlicher Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Dein Name"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-white/25"
              />
            </div>

            <button
              type="button"
              onClick={handleCreateHiker}
              disabled={creating}
              className="mt-4 w-full rounded-2xl bg-stone-100 px-5 py-3 text-sm font-medium text-stone-950 transition hover:bg-white disabled:opacity-60"
            >
              {creating ? 'Wird erstellt…' : 'Profil erstellen'}
            </button>

            {createError && (
              <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                {createError}
              </div>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 w-full rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm text-stone-100 transition hover:bg-white/10"
            >
              Abmelden
            </button>
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

        <section
          className={`mt-8 rounded-[2rem] border bg-gradient-to-b from-white/[0.06] to-white/[0.03] p-6 shadow-2xl backdrop-blur-sm md:p-8 ${
            hiker.division === 'platinum'
              ? 'border-fuchsia-400/30 shadow-[0_0_40px_rgba(217,70,239,0.25)]'
              : hiker.division === 'gold'
              ? 'border-yellow-400/30 shadow-[0_0_40px_rgba(250,204,21,0.2)]'
              : 'border-white/10'
          }`}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <label className="relative flex h-32 w-32 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-black/15 text-5xl shadow-xl shadow-black/10">
                {hiker.profile_image ? (
                  <img
                    src={hiker.profile_image}
                    alt="Profilbild"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  '🥾'
                )}

                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleProfileImageUpload(file)
                  }}
                />

                {!hiker.profile_image && (
                  <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white">
                    ändern
                  </div>
                )}
              </label>

              <div className="min-w-0">
                <div className="text-sm font-semibold uppercase tracking-[0.24em] text-stone-400">
                  Mein Liga-Profil
                </div>

                <h1 className="mt-2 text-4xl font-bold tracking-tight text-white md:text-5xl">
                  {hiker.display_name ?? 'Noch kein Profil'}
                </h1>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/15 px-3 py-1.5 text-sm text-stone-200">
                    <span className="text-base">
                      {countryToFlag(hiker.country ?? null)}
                    </span>
                    <span>{getCountryLabel(hiker.country ?? null)}</span>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/15 px-3 py-1.5 text-sm text-stone-200">
                    <span>{getGenderLabel(hiker.gender)}</span>
                  </div>

                  <div
                    className={`inline-flex rounded-full px-3 py-1.5 text-sm ${getDivisionBadgeClass(
                      hiker.division ?? 'silver'
                    )}`}
                  >
                    {hiker.division ?? 'silver'}
                  </div>

                  {hiker.claimed_profile ? (
                    <div className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/12 px-3 py-1.5 text-sm text-emerald-200">
                      verified profile
                    </div>
                  ) : null}

                  {hasSkyscraper ? (
                    <div className="inline-flex rounded-full border border-sky-400/30 bg-sky-400/12 px-3 py-1.5 text-sm text-sky-200">
                      skyscraper achieved
                    </div>
                  ) : null}
                </div>

                <p className="mt-4 text-sm text-stone-400">
                  Eingeloggt als{' '}
                  <span className="font-semibold text-stone-200">
                    {user?.email}
                  </span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-stone-100 transition hover:-translate-y-0.5 hover:bg-white/10"
            >
              Abmelden
            </button>
          </div>

          <div
            className={
              showProfileMetaForm
                ? 'mt-5 rounded-2xl border border-white/8 bg-black/10 px-4 py-4'
                : 'mt-4'
            }
          >
            {!showProfileMetaForm ? (
              <div className="mt-1 flex items-center justify-between gap-3 text-sm">
                <span className="text-stone-500">
                  Profilangaben gespeichert
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setProfileSaveMessage('')
                    setProfileSaveError('')
                    setShowProfileMetaForm(true)
                  }}
                  className="text-sm font-medium text-stone-300 underline underline-offset-4 transition hover:text-white"
                >
                  Profil bearbeiten
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div className="grid flex-1 gap-4 md:grid-cols-2 xl:max-w-3xl">
                    <div>
                      <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
                        Staatsangehörigkeit
                      </label>
                      <select
                        value={profileCountry}
                        onChange={(e) => setProfileCountry(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                      >
                        <option value="">Bitte auswählen</option>
                        {COUNTRY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
                        Geschlecht
                      </label>
                      <select
                        value={profileGender}
                        onChange={(e) => setProfileGender(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                      >
                        <option value="">Bitte auswählen</option>
                        {GENDER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSaveProfileMeta}
                      disabled={profileSaving}
                      className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-stone-100 transition hover:-translate-y-0.5 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {profileSaving ? 'Speichert…' : 'Speichern'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setProfileCountry(hiker.country ?? '')
                        setProfileGender(hiker.gender ?? '')
                        setProfileSaveMessage('')
                        setProfileSaveError('')
                        setShowProfileMetaForm(false)
                      }}
                      className="rounded-2xl border border-white/10 bg-transparent px-5 py-3 text-sm font-medium text-stone-300 transition hover:bg-white/[0.04] hover:text-white"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>

                {profileSaveError ? (
                  <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                    {profileSaveError}
                  </div>
                ) : null}

                {profileSaveMessage ? (
                  <div className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
                    {profileSaveMessage}
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
            <StatCard
              label="Aktuelle Division"
              value={(hiker.division ?? 'silver').toUpperCase()}
              division={hiker.division}
            />
            <StatCard
              label="Rang Division"
              value={divisionRank ? `#${divisionRank}` : '—'}
              division={hiker.division}
            />
            <StatCard
              label="Rang Overall"
              value={overallRank ? `#${overallRank}` : '—'}
              division={hiker.division}
            />
            <StatCard
              label="Gesamt-km"
              value={`${hiker.total_km ?? '—'} km`}
              division={hiker.division}
            />
            <StatCard
              label="Ø Speed"
              value={`${hiker.avg_speed ?? '—'} km/h`}
              division={hiker.division}
            />
            <StatCard
              label="Höhenmeter"
              value={`${Math.round(totalElevation).toLocaleString('de-DE')} hm`}
              division={hiker.division}
            />
            <StatCard
              label="Skyscraper"
              value={skyscraperRank ? `#${skyscraperRank}` : 'Noch offen'}
              division={hiker.division}
            />
          </div>
        </section>

        {claimRequests.length > 0 && (
          <section className="mt-6 rounded-2xl border border-white/10 bg-black/10 p-4">
            <div className="mb-2 text-sm text-stone-400">
              Deine Anfragen
            </div>

            <div className="space-y-2">
              {claimRequests.slice(0, 3).map((claim) => (
                <div
                  key={claim.id}
                  className="flex items-center justify-between text-sm text-stone-300"
                >
                  <span className="truncate">
                    {claim.profile_name ?? `Hiker ${claim.hiker_id}`}
                  </span>

                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${getClaimStatusClass(
                      claim.status
                    )}`}
                  >
                    {formatClaimStatus(claim.status)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {(rejectedSubmissionNotices.some(
          (notice) => !dismissedSubmissionNoticeIds.includes(notice.id)
        ) ||
          rejectedCorrectionNotices.some(
            (notice) => !dismissedCorrectionNoticeIds.includes(notice.id)
          )) && (
          <section className="mt-6 space-y-3">
            {rejectedSubmissionNotices
              .filter((notice) => !dismissedSubmissionNoticeIds.includes(notice.id))
              .map((notice) => (
                <div
                  key={`submission-notice-${notice.id}`}
                  className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-red-200">
                        <span aria-hidden="true">⚠️</span>
                        <span>Ablehnung deiner Einreichung</span>
                      </div>
                      <div className="mt-1 text-sm text-red-100">
                        Betroffen: {notice.activity_name ?? 'Eintrag'}
                      </div>
                      <div className="mt-2 text-sm text-red-100/90">
                        {notice.admin_note ?? 'Es wurde kein Admin-Hinweis hinterlegt.'}
                      </div>
                      <div className="mt-2 text-xs text-red-200/70">
                        {notice.reviewed_at
                          ? `Geprüft am ${formatDate(notice.reviewed_at.slice(0, 10))}`
                          : 'Geprüft'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => dismissSubmissionNotice(notice.id)}
                      className="shrink-0 rounded-xl border border-red-300/20 bg-black/10 px-3 py-1.5 text-xs text-red-100 transition hover:bg-black/20"
                    >
                      Schließen
                    </button>
                  </div>
                </div>
              ))}

            {rejectedCorrectionNotices
              .filter((notice) => !dismissedCorrectionNoticeIds.includes(notice.id))
              .map((notice) => (
                <div
                  key={`correction-notice-${notice.id}`}
                  className="rounded-2xl border border-orange-400/20 bg-orange-400/10 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                     <div className="flex items-center gap-2 text-sm font-semibold text-red-200">
                       <span aria-hidden="true">⚠️</span>
                       <span>Ablehnung deiner Bearbeitung</span>
                     </div> 
                      <div className="mt-1 text-sm text-orange-100">
                        Betroffen: {notice.activity_name ?? 'Eintrag'}
                      </div>
                      <div className="mt-2 text-sm text-orange-100/90">
                        {notice.admin_note ?? 'Es wurde kein Admin-Hinweis hinterlegt.'}
                      </div>
                      <div className="mt-2 text-xs text-orange-200/70">
                        {notice.reviewed_at
                          ? `Geprüft am ${formatDate(notice.reviewed_at.slice(0, 10))}`
                          : 'Geprüft'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => dismissCorrectionNotice(notice.id)}
                      className="shrink-0 rounded-xl border border-orange-300/20 bg-black/10 px-3 py-1.5 text-xs text-orange-100 transition hover:bg-black/20"
                    >
                      Schließen
                    </button>
                  </div>
                </div>
              ))}
          </section>
        )}

        <section className="mt-10">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Meine Records</h2>
              <div className="mt-4">
                <RecordSubmissionPanel hikerId={hiker.id} />
              </div>
              <p className="mt-1 text-sm text-stone-400">
                Deine verknüpften Leistungen und Event-Ergebnisse.
              </p>
            </div>

            <div className="hidden text-xs uppercase tracking-[0.2em] text-stone-500 md:block">
              Privat
            </div>
          </div>

          <div className="space-y-4">
            {records.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-stone-400">
                Noch keine Records gefunden.
              </div>
            ) : (
              records.map((record) => (
                <div
                  key={record.id}
                  className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/10 transition duration-200 hover:-translate-y-0.5 hover:bg-white/[0.055] hover:shadow-2xl"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm text-stone-500">
                        {formatDate(record.activity_date)}
                      </div>

                      <div className="mt-1 text-xl font-semibold text-white">
                        {record.event_name}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-stone-400">
                        <span className="inline-flex items-center gap-2">
                          <span className="text-base">
                            {countryToFlag(record.country_code)}
                          </span>
                          <span>{record.country}</span>
                        </span>
                        <span>·</span>
                        <span>{record.location}</span>
                        {record.record_source ? (
                          <>
                            <span>·</span>
                            <span>{record.record_source}</span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div
                        className={`inline-flex rounded-full px-3 py-1 text-xs ${getVerifiedClass(
                          record.verified
                        )}`}
                      >
                        {record.verified ? 'verified' : 'unverified'}
                      </div>

                      <div
                        className={`inline-flex rounded-full px-3 py-1 text-xs ${getDivisionBadgeClass(
                          record.division
                        )}`}
                      >
                        {record.division ?? 'silver'}
                      </div>

                      {record.is_corrected ? (
                        <div className="inline-flex rounded-full border border-sky-400/30 bg-sky-400/12 px-3 py-1 text-xs text-sky-200">
                          corrected
                        </div>
                      ) : null}

                      
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                        Distanz
                      </div>
                      <div className="mt-1 font-semibold text-white">
                        {record.distance_km ?? '—'} km
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                        Zeit
                      </div>
                      <div className="mt-1 font-semibold text-white">
                        {formatTime(record.time_text, record.time_hours)}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                        Ø Speed
                      </div>
                      <div className="mt-1 font-semibold text-white">
                        {record.avg_speed ?? '—'} km/h
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                        Höhenmeter
                      </div>
                      <div className="mt-1 font-semibold text-white">
                        {typeof record.elevation_gain === 'number'
                          ? `${Math.round(record.elevation_gain).toLocaleString('de-DE')} hm`
                          : '—'}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                        Status
                      </div>
                      <div className="mt-1 font-semibold text-white">
                        {getRecordStatusLabel(record.record_status)}
                      </div>
                    </div>
                  </div>
                  
                 <RecordEditRequestForm
                   recordId={record.id}
                   hikerId={hiker.id}
                   isOfficialEvent={!!record.event_master_id}
                   initialActivityName={record.event_name}
                   initialActivityDate={record.activity_date}
                   initialOfficialDistanceKm={record.official_distance_km}
                   initialActualDistanceKm={record.actual_distance_km}
                   initialElapsedTimeText={record.time_text}
                   initialElevationGain={record.elevation_gain}
                   initialCountry={record.country}
                   initialLocation={record.location}
                   initialRecordSource={record.record_source}
                 /> 
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  )
}