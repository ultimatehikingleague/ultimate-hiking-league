'use client'

import { useLocale, useTranslations } from 'next-intl'
import type { UiFeedback } from '../../i18n/feedback'
import { LiveBrandPlacement } from '../components/PartnerPlacements'
import { garminAttribution, type GarminRecordAttribution } from '../lib/activity/garmin-attribution'
import { formatDistanceKm, formatElevationMeters, formatElapsedTime } from '../lib/activity/display'
import Link from '@/i18n/prototype/LocalizedLink'
import { useMilestoneLaunch } from '../lib/useMilestoneLaunch'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatRankingDistance } from '@/i18n/display'
import { FIRST_SEASON_YEAR, getSeasonYear, SEASON_RANKINGS_START } from '../lib/season'
import { fetchProfileRanking } from '../lib/rankings'
import SeasonRefresh from '../components/SeasonRefresh'
import ProfileBrandBar from '../components/ProfileBrandBar'
import RecordSubmissionPanel from '../components/RecordSubmissionPanel'
import GarminActivityConnect from '../components/GarminActivityConnect'
import BackToHomeButton from '../components/BackToHomeButton'
import RecordEditRequestForm from '../components/RecordEditRequestForm'
import { countryToFlag, normalizeCountryCode } from '../lib/country'
import RecordVisibilityToggle from '../components/RecordVisibilityToggle'
import { CalendarDays } from 'lucide-react'

type Hiker = {
  id: number
  display_name: string | null
  country: string | null
  gender: string | null
  total_km: number | null
  total_elevation_gain: number | null
  avg_speed: number | null
  division: 'silver' | 'gold' | 'platinum' | null
  claimed_profile: boolean | null
  profile_image: string | null
}

type SeasonStat = {
  season_year: number
  season_km: number
  season_elevation_gain: number
}

type RawRecord = {
  id: number
  event_id: number | null
  event_master_id: number | null
  is_public: boolean
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
  garmin_verified: boolean
  garmin_record_attributions: GarminRecordAttribution
  custom_description: string | null
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
  garmin_verified: boolean
  garmin_record_attributions: GarminRecordAttribution
  custom_description: string | null
  event_name: string
  displayEventName?: string | null
  location: string
  country: string
  country_code: string | null
  event_master_id: number | null
  is_public: boolean
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





function getCountryLabel(countryCode: string | null, countryNames?: Intl.DisplayNames) {
  if (!countryCode) return '—'
  return (
    (countryNames && /^[A-Z]{2}$/.test(countryCode) ? countryNames.of(countryCode) : undefined) ??
    COUNTRY_OPTIONS.find((option) => option.value === countryCode)?.label ??
    countryCode
  )
}

function getGenderLabel(gender: string | null, t: ReturnType<typeof useTranslations<'account'>>) {
  if (!gender) return '—'
  return (
    GENDER_OPTIONS.find((option) => option.value === gender) ? t(gender === 'W' ? 'female' : gender === 'M' ? 'male' : 'diverse') : gender
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

function formatClaimStatus(status: string | null, t: ReturnType<typeof useTranslations<'account'>>) {
  switch (status) {
    case 'approved':
      return t('approved')
    case 'rejected':
      return t('rejected')
    case 'pending':
    default:
      return t('pending')
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

function formatDate(date: string | null) {
  if (!date) return '—'
  const [year, month, day] = date.split('-')
  if (!year || !month || !day) return date
  return `${day}.${month}.${year}`
}

function getRecordStatusLabel(status: string | null, t: ReturnType<typeof useTranslations<'account'>>) {
  switch (status) {
    case 'verified_admin_submission':
      return t('verified')
    case 'verified_elapsed':
      return t('verifiedRecord')
    case 'user_submission':
      return t('inReview')
    default:
      return status ?? '—'
  }
}

const REJECTION_NOTICE_START_DATE = '2026-04-08'

export default function AccountPage() {
  const t = useTranslations('account')
  const ui = useTranslations('ui')
  const year = getSeasonYear()
  const useSeason = year >= SEASON_RANKINGS_START
  const locale = useLocale()
  const feedbackText = (feedback: UiFeedback<'account'>) =>
    locale === 'de' && feedback.detail ? feedback.detail : t(feedback.key)
  const countryNames = new Intl.DisplayNames(locale, { type: 'region' })

  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<UserState | null>(null)
  const [hiker, setHiker] = useState<Hiker | null>(null)
  const [recordRefresh, setRecordRefresh] = useState(0)
  const [records, setRecords] = useState<RecordItem[]>([])
  const [claimRequests, setClaimRequests] = useState<ClaimRequest[]>([])
  const [rejectedSubmissionNotices, setRejectedSubmissionNotices] = useState<RejectedSubmissionNotice[]>([])
  const [rejectedCorrectionNotices, setRejectedCorrectionNotices] = useState<RejectedCorrectionNotice[]>([])
  const [dismissedSubmissionNoticeIds, setDismissedSubmissionNoticeIds] = useState<number[]>([])
  const [dismissedCorrectionNoticeIds, setDismissedCorrectionNoticeIds] = useState<number[]>([])
  const [overallRank, setOverallRank] = useState<number | null>(null)
  const [divisionRank, setDivisionRank] = useState<number | null>(null)
  const [eventAvgSpeed, setEventAvgSpeed] = useState<number | null>(null)
  const [seasonUnavailable, setSeasonUnavailable] = useState(false)
  const [seasonHistory, setSeasonHistory] = useState<SeasonStat[]>([])
  const milestoneLive = useMilestoneLaunch()
  const [milestoneBalance, setMilestoneBalance] = useState<number | null>(null)
  useEffect(() => {
    if (!milestoneLive) { setMilestoneBalance(null); return }
    let cancelled = false
    void supabase.rpc('get_my_milestone_balance').then(({ data, error }) => {
      if (!cancelled) setMilestoneBalance(error ? null : Number(data ?? 0))
    })
    return () => { cancelled = true }
  }, [milestoneLive])
  const [pickedSeasonYear, setPickedSeasonYear] = useState<number | null>(null)
  const seasonYears = [year, ...seasonHistory
    .map(season => season.season_year)
    .filter(seasonYear => seasonYear >= FIRST_SEASON_YEAR && seasonYear < year)]
  const selectedSeasonYear = pickedSeasonYear && seasonYears.includes(pickedSeasonYear) ? pickedSeasonYear : year
  const seasonIndex = seasonYears.indexOf(selectedSeasonYear)
  const selectedSeason = seasonHistory.find(season => season.season_year === selectedSeasonYear)
  const selectedSeasonKm = selectedSeason?.season_km ?? 0
  const selectedSeasonElevation = selectedSeason?.season_elevation_gain ?? 0

  const displayedRecords = useSeason
    ? records.filter(record => record.activity_date?.slice(0, 4) === String(selectedSeasonYear))
    : records
  const [elevationPerKm, setElevationPerKm] = useState<number | null>(null)
  const [skyscraperUnavailable, setSkyscraperUnavailable] = useState(false)
  const [skyscraperRank, setSkyscraperRank] = useState<number | null>(null)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<UiFeedback<'account'> | null>(null)

  const [profileCountry, setProfileCountry] = useState('')
  const [profileGender, setProfileGender] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaveMessage, setProfileSaveMessage] = useState<UiFeedback<'account'> | null>(null)
  const [profileSaveError, setProfileSaveError] = useState<UiFeedback<'account'> | null>(null)
  const [showProfileMetaForm, setShowProfileMetaForm] = useState(false)

  const [showEmailForm, setShowEmailForm] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailChanging, setEmailChanging] = useState(false)
  const [emailChangeError, setEmailChangeError] = useState<UiFeedback<'account'> | null>(null)
  const [emailChangeSuccess, setEmailChangeSuccess] = useState(false)

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
            'id, display_name, country, gender, total_km, total_elevation_gain, avg_speed, division, claimed_profile, profile_image'
          )
          .eq('claimed_by_user_id', session.user.id)
          .limit(1)

        if (hikerError || !hikerRows || hikerRows.length === 0) {
          setLoading(false)
          return
        }

        const currentHiker = hikerRows[0] as Hiker
        setHiker(currentHiker)
        if ((await supabase.rpc('milestone_shop_is_live')).data === true) {
        const { data: milestoneData, error: milestoneError } = await supabase.rpc(
          'get_my_milestone_balance'
        )

        if (milestoneError) {
          console.error('Milestone balance loading failed:', milestoneError)
          setMilestoneBalance(null)
        } else {
          setMilestoneBalance(Number(milestoneData ?? 0))
        }
        }
        setProfileCountry(currentHiker.country ?? '')
        setProfileGender(currentHiker.gender ?? '')
        setShowProfileMetaForm(!currentHiker.country || !currentHiker.gender)

        const [seasonStats, ranks] = await Promise.all([
          supabase.from('hiker_season_stats')
            .select('season_year, season_km, season_elevation_gain')
            .eq('hiker_id', currentHiker.id)
            .order('season_year', { ascending: false }),
          fetchProfileRanking(currentHiker.id, year),
        ])
        setSeasonUnavailable(!!seasonStats.error)
        if (seasonStats.error) console.error('Season stats load error:', seasonStats.error)
        setSeasonHistory((seasonStats.data ?? []).map(row => ({
          season_year: Number(row.season_year),
          season_km: Number(row.season_km ?? 0),
          season_elevation_gain: Number(row.season_elevation_gain ?? 0),
        })))
        setOverallRank(ranks.overall)
        setDivisionRank(ranks.division)
        setSkyscraperRank(ranks.skyscraper)
        setSkyscraperUnavailable(ranks.skyscraperUnavailable)

        const { data: recordRows, error: recordsError } = await supabase
          .from('records')
          .select(
            'id, event_id, event_master_id, is_public, event_distance_id, distance_km, time_hours, avg_speed, activity_date, division, record_status, verified, time_text, record_source, is_corrected, elevation_gain, custom_title, custom_location, custom_country, garmin_verified, garmin_record_attributions(device_model), custom_description'
          )
          .eq('hiker_id', currentHiker.id)
          .order('activity_date', { ascending: false })

        if (recordsError || !recordRows || recordRows.length === 0) {
          setRecords([])
          setLoading(false)
          return
        }

        const rawRecords = recordRows as RawRecord[]

        const eventRecords = rawRecords.filter(
          (record) => record.event_master_id
        )

        const totalEventDistance = eventRecords.reduce(
          (sum, record) =>
            sum + (typeof record.distance_km === 'number' ? record.distance_km : 0),
          0
        )

        const totalEventHours = eventRecords.reduce(
          (sum, record) =>
            sum + (typeof record.time_hours === 'number' ? record.time_hours : 0),
          0
        )

        const eventAvgSpeedValue =
          totalEventHours > 0
            ? totalEventDistance / totalEventHours
            : null

        setEventAvgSpeed(eventAvgSpeedValue)

        const totalDistance = rawRecords.reduce(
          (sum, record) =>
            sum + (typeof record.distance_km === 'number' ? record.distance_km : 0),
          0
        )


       const totalElevationValue = rawRecords.reduce((sum, record) => {
          return (
            sum +
            (typeof record.elevation_gain === 'number'
              ? record.elevation_gain
              : 0)
          )
        }, 0)

        const elevationPerKmValue =
          totalDistance > 0
            ? totalElevationValue / totalDistance
            : null

        setElevationPerKm(elevationPerKmValue)

      
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
            displayEventName: event?.title ?? record.custom_title,
            location: event?.city ?? record.custom_location ?? '—',
            country: event?.country ?? record.custom_country ?? '—',
            country_code: event?.country_code ?? normalizeCountryCode(record.custom_country),
            official_distance_km: event ? eventDistance?.distance_km ?? null : null,
            actual_distance_km: record.distance_km ?? null,
          }
        })

        setRecords(mergedRecords)
      } catch (error) {
        console.error('AccountPage loadData error:', error)
        setOverallRank(null)
        setDivisionRank(null)
        setSkyscraperRank(null)
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [recordRefresh, year])

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
        alert(locale === 'en' || locale === 'de' ? 'Upload fehlgeschlagen' : t('uploadFailed'))
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
        alert(t('couldNotSave'))
        return
      }

      setHiker((prev) =>
        prev ? { ...prev, profile_image: publicUrl } : prev
      )
    } catch (err) {
      console.error(err)
      alert(t('uploadFailed'))
    }
  }

  async function handleSaveProfileMeta() {
    if (!hiker) return

    setProfileSaving(true)
    setProfileSaveMessage(null)
    setProfileSaveError(null)

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
        setProfileSaveError({ key: 'profileCouldNotBeSaved', detail: error.message })
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

      setProfileSaveMessage({ key: 'yourProfileDetailsWereSaved' })
      setShowProfileMetaForm(false)
    } catch (error: any) {
      setProfileSaveError({ key: 'profileCouldNotBeSaved', detail: error?.message })
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

  async function handleEmailChange() {
    const email = newEmail.trim().toLowerCase()

    if (!email) {
      setEmailChangeError({ key: 'enterANewEmailAddress' })
      return
    }

    if (email === user?.email?.toLowerCase()) {
      setEmailChangeError({ key: 'theNewEmailAddressMatchesYour' })
      return
    }

    setEmailChanging(true)
    setEmailChangeError(null)
    setEmailChangeSuccess(false)

    const { error } = await supabase.auth.updateUser({
      email,
    })

    if (error) {
      console.error('Email change failed:', error)
      setEmailChangeError({ key: 'emailChangeFailed' })
      setEmailChanging(false)
      return
    }

    setEmailChangeSuccess(true)
    setEmailChanging(false)
  }

  async function handleCreateHiker() {
    if (!newName.trim()) return

    setCreating(true)
    setCreateError(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        setCreateError({ key: 'yourSessionHasExpiredPleaseSign' })
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
        setCreateError({ key: 'profileCouldNotBeCreated', detail: error.message })
        return
      }

      window.location.reload()
    } catch (error: any) {
      setCreateError({ key: 'profileCouldNotBeCreated', detail: error?.message })
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
      <SeasonRefresh year={year} />
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-xl shadow-black/10 backdrop-blur-sm">
          <h1 className="text-2xl font-bold text-white">
            {t('loadingLeagueProfile')}
          </h1>
          <p className="mt-3 text-stone-400">{t('pleaseWaitAMoment')}</p>
        </div>
      </main>
    )
  }

  if (!hiker) {
    return (
      <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
      <SeasonRefresh year={year} />
        <div className="mx-auto max-w-xl">
          <BackToHomeButton label={t('backToTheHomepage')} />

          <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-xl shadow-black/10 backdrop-blur-sm">
            <h1 className="text-2xl font-bold text-white">{t('createProfile')}</h1>
            <p className="mt-3 text-stone-400">
              {t('enterYourLegalNameToCreate')}
            </p>

            <div className="mt-6">
              <label className="mb-2 block text-sm font-medium text-stone-300">
                {t('legalName')}
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('yourName')}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-white/25"
              />
            </div>

            <button
              type="button"
              onClick={handleCreateHiker}
              disabled={creating}
              className="mt-4 w-full rounded-2xl bg-stone-100 px-5 py-3 text-sm font-medium text-stone-950 transition hover:bg-white disabled:opacity-60"
            >
              {creating ? t('creating') : t('createProfile')}
            </button>

            {createError && (
              <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                {feedbackText(createError)}
              </div>
            )}

            <div className="mt-3 space-y-3">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm text-stone-100 transition hover:bg-white/10"
              >
                {t('signOut')}
              </button>
            </div>
          </div>
          <div id="garmin-connect" className="mt-6 scroll-mt-6">
            <GarminActivityConnect />
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
      <SeasonRefresh year={year} />
      <div className="mx-auto max-w-6xl">
        <ProfileBrandBar />

        <Link
          href="/"
          className="text-sm text-stone-400 transition hover:text-white"
        >
          {t('backToTheHomepage')}
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
                    alt={t('profilePicture')}
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
                    {t('changePicture')}
                  </div>
                )}
              </label>

              <div className="min-w-0">
                <div className="text-sm font-semibold uppercase tracking-[0.24em] text-stone-400">
                  {t('myLeagueProfile')}
                </div>

                <h1 className="mt-2 text-4xl font-bold tracking-tight text-white md:text-5xl">
                  {hiker.display_name ?? t('noProfileYet')}
                </h1>

                {milestoneLive && (<>
                {/* Milestone-Guthaben */}
                <div className="mt-4 flex items-center gap-5">
                  <img
                    src="/images/milestone.png"
                    alt="Milestone"
                    className="h-12 w-12 object-contain"
                  />

                  <div>
                    <div className="text-2xl font-bold" style={{ color: '#67DCE8' }}>
                      {milestoneBalance === null
                        ? '–'
                        : milestoneBalance.toLocaleString('de-DE')}
                    </div>
                    <div className="text-xs font-semibold uppercase tracking-widest text-cyan-300">
                      Milestones
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href="/milestone-shop"
                      className="rounded-xl bg-[#67DCE8] px-4 py-2.5 text-sm font-bold text-[#07111a] transition hover:bg-[#8CEAF2]"
                    >
                      {t('goToTheShop')}
                    </Link>

                    <Link
                      href="/account/rewards"
                      className="rounded-xl border border-[#67DCE8]/30 bg-[#67DCE8]/10 px-4 py-2.5 text-sm font-semibold text-[#67DCE8] transition hover:bg-[#67DCE8]/20"
                    >
                      {t('myRewards')}
                    </Link>
                  </div>
                </div>

                </>)}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/15 px-3 py-1.5 text-sm text-stone-200">
                    <span className="text-base">
                      {countryToFlag(hiker.country ?? null)}
                    </span>
                    <span>{getCountryLabel(hiker.country ?? null, locale === 'de' ? undefined : countryNames)}</span>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/15 px-3 py-1.5 text-sm text-stone-200">
                    <span>{getGenderLabel(hiker.gender, t)}</span>
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
                      {t('verifiedProfile')}
                    </div>
                  ) : null}

                  {skyscraperRank ? (
                    <div className="inline-flex rounded-full border border-sky-400/30 bg-sky-400/12 px-3 py-1.5 text-sm text-sky-200">
                      {t('skyscraperAchieved')}
                    </div>
                  ) : null}
                </div>

                <p className="mt-4 text-sm text-stone-400">
                  {t('signedInAs')}{' '}
                  <span className="font-semibold text-stone-200">
                    {user?.email}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/account/calendar"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-stone-100 transition hover:-translate-y-0.5 hover:bg-white/10"
              >
                <CalendarDays className="h-4 w-4" />
                {t('myCalendar')}
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-stone-100 transition hover:-translate-y-0.5 hover:bg-white/10"
              >
                {t('signOut')}
              </button>
            </div>
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
                  {t('profileDetailsSaved')}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setProfileSaveMessage(null)
                    setProfileSaveError(null)
                    setShowProfileMetaForm(true)
                  }}
                  className="text-sm font-medium text-stone-300 underline underline-offset-4 transition hover:text-white"
                >
                  {t('editProfile')}
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-4">
                  <div className="grid flex-1 gap-4 md:grid-cols-2 xl:max-w-3xl">
                    <div>
                      <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
                        {t('nationality')}
                      </label>
                      <select
                        value={profileCountry}
                        onChange={(e) => setProfileCountry(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                      >
                        <option value="">{t('pleaseSelect')}</option>
                        {COUNTRY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {locale === 'de' ? option.label : countryNames.of(option.value) ?? option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
                        {t('gender')}
                      </label>
                      <select
                        value={profileGender}
                        onChange={(e) => setProfileGender(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                      >
                        <option value="">{t('pleaseSelect')}</option>
                        {GENDER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {getGenderLabel(option.value, t)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="w-full rounded-2xl border border-white/10 bg-black/15 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
                          {t('emailAddress')}
                        </div>
                        <div className="mt-1 text-sm text-stone-200">
                          {user?.email && user.email !== 'Unbekannt' ? user.email : t('unknown')}
                        </div>
                      </div>

                      {!showEmailForm ? (
                        <button
                          type="button"
                          onClick={() => {
                            setShowEmailForm(true)
                            setNewEmail('')
                            setEmailChangeError(null)
                            setEmailChangeSuccess(false)
                          }}
                          className="shrink-0 text-sm font-medium text-stone-300 underline underline-offset-4 transition hover:text-white"
                        >
                          {t('changeEmail')}
                        </button>
                      ) : null}
                    </div>

                    {showEmailForm ? (
                      <div className="mt-4 border-t border-white/10 pt-4">
                        <p className="text-xs leading-5 text-stone-400">
                          <span className="font-medium text-stone-200">{t('important')}</span>{' '}
                          {t('forSecurityConfirmTheChangeFrom')}
                        </p>

                        <label className="mt-4 mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
                          {t('newEmailAddress')}
                        </label>

                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder={t('emailPlaceholder')}
                          autoComplete="email"
                          className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none transition focus:border-white/25"
                        />

                        <div className="mt-3 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={handleEmailChange}
                            disabled={emailChanging}
                            className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-stone-100 transition hover:bg-white/10 disabled:opacity-60"
                          >
                            {emailChanging
                              ? t('requestingChange')
                              : t('requestEmailChange')}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowEmailForm(false)
                              setNewEmail('')
                              setEmailChangeError(null)
                              setEmailChangeSuccess(false)
                            }}
                            disabled={emailChanging}
                            className="rounded-2xl border border-white/10 px-5 py-3 text-sm text-stone-400 transition hover:text-white disabled:opacity-60"
                          >
                            {t('cancel')}
                          </button>
                        </div>

                        {emailChangeError ? (
                          <div className="mt-3 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200">
                            {feedbackText(emailChangeError)}
                          </div>
                        ) : null}

                        {emailChangeSuccess ? (
                          <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-3 text-xs leading-5 text-emerald-200">
                            {t('yourChangeHasBeenRequestedCheck')}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSaveProfileMeta}
                      disabled={profileSaving}
                      className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-stone-100 transition hover:-translate-y-0.5 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {profileSaving ? t('saving') : t('save')}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setProfileCountry(hiker.country ?? '')
                        setProfileGender(hiker.gender ?? '')
                        setProfileSaveMessage(null)
                        setProfileSaveError(null)
                        setShowProfileMetaForm(false)
                      }}
                      className="rounded-2xl border border-white/10 bg-transparent px-5 py-3 text-sm font-medium text-stone-300 transition hover:bg-white/[0.04] hover:text-white"
                    >
                      {t('cancel')}
                    </button>
                  </div>
                </div>

                {profileSaveError ? (
                  <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                    {feedbackText(profileSaveError)}
                  </div>
                ) : null}

                {profileSaveMessage ? (
                  <div className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
                    {feedbackText(profileSaveMessage)}
                  </div>
                ) : null}
              </>
            )}
          </div>

          {seasonYears.length > 1 ? (
            <div className="mt-8">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                {t('season')}
              </div>

              <div className="flex w-full items-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                <button
                  type="button"
                  onClick={() => setPickedSeasonYear(seasonYears[seasonIndex + 1])}
                  disabled={seasonIndex >= seasonYears.length - 1}
                  className="flex h-14 w-16 shrink-0 items-center justify-center border-r border-white/10 text-3xl text-stone-300 transition active:bg-white/10 disabled:opacity-20"
                  aria-label={t('previousSeason')}
                >
                  ‹
                </button>

                <div className="flex h-14 min-w-0 flex-1 items-center justify-center">
                  <span className="text-lg font-bold text-white">
                    {selectedSeasonYear}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setPickedSeasonYear(seasonYears[seasonIndex - 1])}
                  disabled={seasonIndex <= 0}
                  className="flex h-14 w-16 shrink-0 items-center justify-center border-l border-white/10 text-3xl text-stone-300 transition active:bg-white/10 disabled:opacity-20"
                  aria-label={t('nextSeason')}
                >
                  ›
                </button>
              </div>
            </div>
                    ) : null}

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <StatCard
              label={ui('seasonDistance', { year: selectedSeasonYear })}
              value={seasonUnavailable ? ui('rankingUnavailable') : `${formatRankingDistance(selectedSeasonKm, locale)} km`}
              division={hiker.division}
            />
            <StatCard
              label={ui('allTimeDistance')}
              value={`${formatRankingDistance(hiker.total_km ?? 0, locale)} km`}
              division={hiker.division}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label={t('currentDivision')}
              value={(hiker.division ?? 'silver').toUpperCase()}
              division={hiker.division}
            />

            <StatCard
              label={useSeason ? ui('divisionSeasonRank', { year }) : t('divisionRank')}
              value={divisionRank ? `#${divisionRank}` : '—'}
              division={hiker.division}
            />

            <StatCard
              label={useSeason ? ui('seasonRank', { year }) : ui('allTimeRank')}
              value={overallRank ? `#${overallRank}` : '—'}
              division={hiker.division}
            />

            {useSeason ? (
              <StatCard
                label={t('seasonElevation', { year: selectedSeasonYear })}
                value={seasonUnavailable ? ui('rankingUnavailable') : `${Math.round(selectedSeasonElevation).toLocaleString(locale)} hm`}
                division={hiker.division}
              />
            ) : null}

            <StatCard
              label={t('averageSpeed')}
              value={`${hiker.avg_speed ?? '—'} km/h`}
              division={hiker.division}
            />
            <StatCard
              label={t('averageEventSpeed')}
              value={eventAvgSpeed !== null ? `${eventAvgSpeed.toFixed(2)} km/h` : '-'}
              division={hiker.division}
            />
            <StatCard
              label={t('elevationGain')}
              value={`${Math.round(hiker.total_elevation_gain ?? 0).toLocaleString('de-DE')} hm`}
              division={hiker.division}
            />
            <StatCard
              label={t('elevationGainPerKm')}
              value={elevationPerKm !== null ? `${elevationPerKm.toFixed(1)} hm/km` : '-'}
              division={hiker.division}
            />
            <StatCard
              label="Skyscraper"
              value={skyscraperRank ? `#${skyscraperRank}` : skyscraperUnavailable ? ui('rankingUnavailable') : t('notYetAchieved')}
              division={hiker.division}
            />
          </div>
        </section>

        {claimRequests.length > 0 && (
          <section className="mt-6 rounded-2xl border border-white/10 bg-black/10 p-4">
            <div className="mb-2 text-sm text-stone-400">
              {t('yourRequests')}
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
                    {formatClaimStatus(claim.status, t)}
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
                        <span>{t('submissionDeclined')}</span>
                      </div>
                      <div className="mt-1 text-sm text-red-100">
                        {t('affectedRecord')} {notice.activity_name ?? t('record')}
                      </div>
                      <div className="mt-2 text-sm text-red-100/90">
                        {notice.admin_note ?? t('noNoteWasProvidedByThe')}
                      </div>
                      <div className="mt-2 text-xs text-red-200/70">
                        {notice.reviewed_at
                          ? t('reviewedOn', { date: formatDate(notice.reviewed_at.slice(0, 10)) })
                          : t('reviewed')}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => dismissSubmissionNotice(notice.id)}
                      className="shrink-0 rounded-xl border border-red-300/20 bg-black/10 px-3 py-1.5 text-xs text-red-100 transition hover:bg-black/20"
                    >
                      {t('close')}
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
                       <span>{t('editRequestDeclined')}</span>
                     </div> 
                      <div className="mt-1 text-sm text-orange-100">
                        {t('affectedRecord')} {notice.activity_name ?? t('record')}
                      </div>
                      <div className="mt-2 text-sm text-orange-100/90">
                        {notice.admin_note ?? t('noNoteWasProvidedByThe')}
                      </div>
                      <div className="mt-2 text-xs text-orange-200/70">
                        {notice.reviewed_at
                          ? t('reviewedOn', { date: formatDate(notice.reviewed_at.slice(0, 10)) })
                          : t('reviewed')}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => dismissCorrectionNotice(notice.id)}
                      className="shrink-0 rounded-xl border border-orange-300/20 bg-black/10 px-3 py-1.5 text-xs text-orange-100 transition hover:bg-black/20"
                    >
                      {t('close')}
                    </button>
                  </div>
                </div>
              ))}
          </section>
        )}

        <LiveBrandPlacement surface="account" />

        <section className="mt-10">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">{t('myRecords')}</h2>
              <p className="mt-1 text-sm text-stone-400">
                {t('yourLinkedHikingRecordsAndEvent')}
              </p>
            </div>

            <div className="hidden text-xs uppercase tracking-[0.2em] text-stone-500 md:block">
              {t('private')}
            </div>
          </div>

          <div className="mb-5">
            <RecordSubmissionPanel hikerId={hiker.id} onPublished={() => setRecordRefresh(value => value + 1)} />
          </div>

          <div className="space-y-4">
            {displayedRecords.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-stone-400">
                {t('noRecordsYet')}
              </div>
            ) : (
              displayedRecords.map((record) => (
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
                        {record.displayEventName ?? t('privateRecord')}
                      </div>

                      {record.garmin_verified && (
                        <div className="mt-1 text-sm text-stone-300">{garminAttribution(record)}</div>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-stone-400">
                        <span className="inline-flex items-center gap-2">
                          <span className="text-base">
                            {countryToFlag(record.country_code)}
                          </span>
                          <span>{record.country}</span>
                        </span>
                        <span>·</span>
                        <span>{record.location}</span>
                        {record.record_source && !record.garmin_verified ? (
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
                        {record.verified ? t('verified') : t('unverified')}
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
                          {t('corrected')}
                        </div>
                      ) : null}

                      
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                        {t('distance')}
                      </div>
                      <div className="mt-1 font-semibold text-white">
                        {formatDistanceKm(record.distance_km) ?? '—'} km
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                        {t('time')}
                      </div>
                      <div className="mt-1 font-semibold text-white">
                        {formatElapsedTime(record.time_text, record.time_hours) ?? '—'}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                        {t('averageSpeed')}
                      </div>
                      <div className="mt-1 font-semibold text-white">
                        {record.avg_speed ?? '—'} km/h
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                        {t('elevationGain')}
                      </div>
                      <div className="mt-1 font-semibold text-white">
                        {typeof record.elevation_gain === 'number'
                          ? `${formatElevationMeters(record.elevation_gain)} hm`
                          : '—'}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                        {t('status')}
                      </div>
                      <div className="mt-1 font-semibold text-white">
                        {getRecordStatusLabel(record.record_status, t)}
                      </div>
                    </div>
                  </div>

                  {!record.event_master_id ? (
                    <RecordVisibilityToggle
                      recordId={record.id}
                      initialIsPublic={record.is_public !== false}
                    />
                  ) : null}
                  
                  {record.custom_description && (
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm text-stone-300">{record.custom_description}</p>
                  )}
                 <RecordEditRequestForm
                   recordId={record.id}
                   hikerId={hiker.id}
                   isOfficialEvent={!!record.event_master_id}
                   garminVerified={record.garmin_verified}
                   initialDescription={record.custom_description}
                   initialActivityName={record.displayEventName ?? t('privateRecord')}
                   initialActivityDate={record.activity_date}
                   initialOfficialDistanceKm={record.official_distance_km}
                   initialActualDistanceKm={record.actual_distance_km}
                   initialElapsedTimeText={record.time_text}
                   initialElevationGain={record.elevation_gain}
                   initialCountry={record.garmin_verified && record.country === '—' ? '' : record.country}
                   initialLocation={record.garmin_verified && record.location === '—' ? '' : record.location}
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