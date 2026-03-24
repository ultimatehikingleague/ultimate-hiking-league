'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import ProfileBrandBar from '../components/ProfileBrandBar'
import RecordSubmissionPanel from '../components/RecordSubmissionPanel'

type Hiker = {
  id: number
  display_name: string | null
  country: string | null
  total_km: number | null
  avg_speed: number | null
  division: 'silver' | 'gold' | 'platinum' | null
  claimed_profile: boolean | null
  profile_image: string | null
}

type RawRecord = {
  id: number
  event_id: number | null
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
}

type EventItem = {
  id: number
  event_name: string | null
  location: string | null
  country: string | null
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
}

type RankedHiker = {
  id: number
  total_km: number | null
  division: string | null
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

const SKYSCRAPER_THRESHOLD = 1500

function countryToFlag(countryCode: string | null) {
  if (!countryCode) return '—'
  const code = countryCode.trim().toUpperCase()
  if (code.length !== 2) return '—'
  return String.fromCodePoint(
    ...[...code].map((char) => 127397 + char.charCodeAt(0))
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

function formatDateTime(date: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleString('de-DE')
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



async function fetchAllRankedHikers(): Promise<RankedHiker[]> {
  const pageSize = 1000
  let from = 0
  let allRows: RankedHiker[] = []

  while (true) {
    const { data, error } = await supabase
      .from('hikers')
      .select('id, total_km, division')
      .range(from, from + pageSize - 1)

    if (error || !data || data.length === 0) {
      break
    }

    allRows = allRows.concat(data as RankedHiker[])

    if (data.length < pageSize) {
      break
    }

    from += pageSize
  }

  return allRows
}

export default function AccountPage() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<UserState | null>(null)
  const [hiker, setHiker] = useState<Hiker | null>(null)
  const [records, setRecords] = useState<RecordItem[]>([])
  const [claimRequests, setClaimRequests] = useState<ClaimRequest[]>([])
  const [overallRank, setOverallRank] = useState<number | null>(null)
  const [divisionRank, setDivisionRank] = useState<number | null>(null)
  const [totalElevation, setTotalElevation] = useState<number>(0)
  const [hasSkyscraper, setHasSkyscraper] = useState(false)

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

        const { data: hikerRows, error: hikerError } = await supabase
          .from('hikers')
          .select(
            'id, display_name, country, total_km, avg_speed, division, claimed_profile, profile_image'
          )
          .eq('claimed_by_user_id', session.user.id)
          .limit(1)

        if (hikerError || !hikerRows || hikerRows.length === 0) {
          setLoading(false)
          return
        }

        const currentHiker = hikerRows[0] as Hiker
        setHiker(currentHiker)

        const allHikerRows = await fetchAllRankedHikers()

        if (allHikerRows.length > 0) {
          const ranked = allHikerRows
            .filter(
              (item) =>
                typeof item.id === 'number' &&
                typeof item.total_km === 'number' &&
                item.total_km > 0
            )
            .sort((a, b) => (b.total_km ?? 0) - (a.total_km ?? 0))

          const overallIndex = ranked.findIndex(
            (item) => item.id === currentHiker.id
          )
          setOverallRank(overallIndex >= 0 ? overallIndex + 1 : null)

          const rankedDivision = ranked.filter(
            (item) => item.division === currentHiker.division
          )

          const divisionIndex = rankedDivision.findIndex(
            (item) => item.id === currentHiker.id
          )
          setDivisionRank(divisionIndex >= 0 ? divisionIndex + 1 : null)
        } else {
          setOverallRank(null)
          setDivisionRank(null)
        }

        const { data: recordRows, error: recordsError } = await supabase
          .from('records')
          .select(
            'id, event_id, distance_km, time_hours, avg_speed, activity_date, division, record_status, verified, time_text, record_source, is_corrected, elevation_gain'
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

        const eventIds = Array.from(
          new Set(
            rawRecords
              .map((record) => record.event_id)
              .filter((eventId): eventId is number => typeof eventId === 'number')
          )
        )

        let eventsMap = new Map<number, EventItem>()

        if (eventIds.length > 0) {
          const { data: eventRows } = await supabase
            .from('events')
            .select('id, event_name, location, country')
            .in('id', eventIds)

          if (eventRows) {
            eventsMap = new Map(
              (eventRows as EventItem[]).map((event) => [event.id, event])
            )
          }
        }

        const mergedRecords: RecordItem[] = rawRecords.map((record) => {
          const event = record.event_id ? eventsMap.get(record.event_id) : null

          return {
            ...record,
            event_name: event?.event_name ?? 'Unbekanntes Event',
            location: event?.location ?? '—',
            country: event?.country ?? '—',
          }
        })

        setRecords(mergedRecords)
      } catch (error) {
        console.error('AccountPage loadData error:', error)
        setOverallRank(null)
        setDivisionRank(null)
        setTotalElevation(0)
        setHasSkyscraper(false)
      } finally {
        setLoading(false)
      }
    }

    void loadData()
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

    // UI sofort aktualisieren
    setHiker((prev) =>
      prev ? { ...prev, profile_image: publicUrl } : prev
    )
  } catch (err) {
    console.error(err)
    alert('Fehler beim Upload')
  }
}
  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/'
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
        <div className="mx-auto max-w-6xl">
          <Link
            href="/"
            className="text-sm text-stone-400 transition hover:text-white"
          >
            ← Zurück zur Startseite
          </Link>

          <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-xl shadow-black/10 backdrop-blur-sm">
            <h1 className="text-2xl font-bold text-white">
              Kein verknüpftes Profil gefunden
            </h1>
            <p className="mt-3 text-stone-400">
              Für diesen Login ist aktuell noch kein Hiker-Profil hinterlegt.
            </p>
          </div>

          {claimRequests.length > 0 ? (
            <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/10 backdrop-blur-sm">
              <h2 className="text-2xl font-bold text-white">
                Meine Claim-Anfragen
              </h2>
              <p className="mt-1 text-sm text-stone-400">
                Hier siehst du den Stand deiner bisherigen Profil-Anfragen.
              </p>

              <div className="mt-5 space-y-4">
                {claimRequests.map((claim) => (
                  <div
                    key={claim.id}
                    className="rounded-[1.5rem] border border-white/10 bg-black/10 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="text-sm text-stone-500">
                          Anfrage vom {formatDateTime(claim.created_at)}
                        </div>
                        <div className="mt-1 text-lg font-semibold text-white">
                          {claim.profile_name ?? `Hiker-ID ${claim.hiker_id}`}
                        </div>
                      </div>

                      <div
                        className={`inline-flex rounded-full px-3 py-1 text-xs ${getClaimStatusClass(
                          claim.status
                        )}`}
                      >
                        {formatClaimStatus(claim.status)}
                      </div>
                    </div>

                    {claim.admin_note ? (
                      <div className="mt-4 rounded-2xl border border-white/8 bg-black/10 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                          Admin-Vermerk
                        </div>
                        <div className="mt-2 text-sm text-stone-200">
                          {claim.admin_note}
                        </div>
                      </div>
                    ) : null}

                    {claim.reviewed_at ? (
                      <div className="mt-3 text-xs text-stone-500">
                        Geprüft am {formatDateTime(claim.reviewed_at)}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
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
                  // eslint-disable-next-line @next/next/no-img-element
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
                    <span>{hiker.country ?? '—'}</span>
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
              label="Ø Geschwindigkeit"
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
              value={hasSkyscraper ? 'Aktiv' : 'Noch offen'}
              division={hiker.division}
            />
          </div>
        </section>

        {claimRequests.length > 0 && (
          <section className="mt-6 rounded-2xl border border-white/10 bg-black/10 p-4">
            <div className="text-sm text-stone-400 mb-2">
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
                            {countryToFlag(record.country)}
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

                  {/* 
                  <div className="mt-4">
                    <button
                      type="button"
                      className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm"
                  >
                      Korrektur später hier
                    </button>
                  </div>
                  */}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
