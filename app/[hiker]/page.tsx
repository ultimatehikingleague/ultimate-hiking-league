import Link from 'next/link'
import { supabase } from '../lib/supabase'
import CorrectionRequestForm from '../components/CorrectionRequestForm'
import ProfileBrandBar from '../components/ProfileBrandBar'
import ClaimProfilePanel from '../components/ClaimProfilePanel'

function getDivisionBadgeClass(division: string | null) {
  switch (division) {
    case 'platinum':
      return 'border border-fuchsia-400/30 bg-fuchsia-400/12 text-fuchsia-200'
    case 'gold':
      return 'border border-yellow-400/30 bg-yellow-400/12 text-yellow-200'
    case 'silver':
      return 'border border-stone-300/25 bg-stone-300/10 text-stone-100'
    default:
      return 'border border-stone-300/20 bg-stone-300/5 text-stone-400'
  }
}

function getRecordStatusClass(status: string | null) {
  if (!status) {
    return 'border border-stone-300/20 bg-stone-300/5 text-stone-400'
  }

  if (status.toLowerCase().includes('verified')) {
    return 'border border-emerald-400/30 bg-emerald-400/12 text-emerald-200'
  }

  return 'border border-stone-300/20 bg-stone-300/5 text-stone-300'
}

function formatSpeed(speed: number | null) {
  if (speed === null || speed === undefined) return '—'
  return `${speed} km/h`
}

function formatTime(timeText: string | null) {
  if (!timeText) return '—'
  return timeText
}

function formatDate(dateText: string | null) {
  if (!dateText) return '—'
  const date = new Date(dateText)
  return date.toLocaleDateString('de-DE')
}

function countryToFlag(country: string | null) {
  if (!country) return ''
  const code = country.trim().toUpperCase()
  if (code.length !== 2) return ''
  return String.fromCodePoint(
    ...[...code].map((char) => 127397 + char.charCodeAt(0))
  )
}

function getEventDisplayName(event: any) {
  if (event?.event_name && event.event_name.trim() !== '') {
    return event.event_name
  }
  return 'Privater Eintrag'
}

const SKYSCRAPER_THRESHOLD = 1500

export default async function HikerPage({
  params,
}: {
  params: Promise<{ hiker: string }>
}) {
  const { hiker } = await params

  const { data: hikerData, error: hikerError } = await supabase
    .from('hikers')
    .select(
      'id, display_name, total_km, division, country, avg_speed, profile_image, claimed_profile'
    )
    .eq('id', hiker)
    .single()

  if (hikerError || !hikerData) {
    return (
      <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
        <div className="mx-auto max-w-5xl">
          <ProfileBrandBar />

          <Link
            href="/leaderboard/overall"
            className="mb-6 inline-block text-sm text-stone-400 transition hover:text-white"
          >
            ← Zurück zum Ranking
          </Link>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-xl shadow-black/10">
            <p className="text-stone-300">Hiker nicht gefunden 😢</p>
          </div>
        </div>
      </main>
    )
  }

  const { data: allHikers } = await supabase
    .from('hikers')
    .select('id, total_km, display_name, division')
    .order('total_km', { ascending: false })
    .order('display_name', { ascending: true })

  const overallRank =
    allHikers?.findIndex((entry) => entry.id === hikerData.id) !== undefined &&
    allHikers?.findIndex((entry) => entry.id === hikerData.id) !== -1
      ? (allHikers?.findIndex((entry) => entry.id === hikerData.id) ?? 0) + 1
      : null

  const sameDivision =
    allHikers?.filter((entry) => entry.division === hikerData.division) ?? []

  const divisionRank =
    sameDivision.findIndex((entry) => entry.id === hikerData.id) !== -1
      ? sameDivision.findIndex((entry) => entry.id === hikerData.id) + 1
      : null

  const { data: recordsData, error: recordsError } = await supabase
    .from('records')
    .select(
      `
        id,
        distance_km,
        avg_speed,
        division,
        time_text,
        activity_date,
        record_status,
        event_id,
        is_corrected,
        elevation_gain
      `
    )
    .eq('hiker_id', hiker)
    .order('activity_date', { ascending: false })

  const eventIds =
    recordsData?.map((record) => record.event_id).filter(Boolean) ?? []

  const { data: eventsData } =
    eventIds.length > 0
      ? await supabase
          .from('events')
          .select(
            'id, event_name, event_date, location, country, organizer, event_type, official_distance_km, is_walking_backyard'
          )
          .in('id', eventIds)
      : { data: [] as any[] }

  const eventsMap = new Map((eventsData ?? []).map((event) => [event.id, event]))

  const totalElevation =
    recordsData?.reduce((sum, record) => {
      return sum + (typeof record.elevation_gain === 'number' ? record.elevation_gain : 0)
    }, 0) ?? 0

  const hasSkyscraper = totalElevation >= SKYSCRAPER_THRESHOLD

  return (
    <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
      <div className="mx-auto max-w-5xl">
        <ProfileBrandBar />

        <Link
          href="/leaderboard/overall"
          className="mb-6 inline-block text-sm text-stone-400 transition hover:text-white"
        >
          ← Zurück zum Ranking
        </Link>

        <section className="mb-8 rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.03] p-6 shadow-2xl shadow-black/20 backdrop-blur-sm md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <div className="flex h-28 w-28 items-center justify-center rounded-[2rem] border border-white/10 bg-black/15 text-4xl shadow-xl shadow-black/10">
              {hikerData.profile_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={hikerData.profile_image}
                  alt={hikerData.display_name ?? 'Hiker'}
                  className="h-28 w-28 rounded-[2rem] object-cover"
                />
              ) : (
                '🥾'
              )}
            </div>

            <div className="flex-1">
              <div className="mb-3">
                <div className="text-sm font-semibold uppercase tracking-[0.24em] text-stone-400">
                  Liga-Profil
                </div>

                <h1 className="mt-2 text-4xl font-bold tracking-tight text-white md:text-5xl">
                  {hikerData.display_name ?? 'Unbekannt'}
                </h1>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/15 px-3 py-1.5 text-sm text-stone-200">
                  <span className="text-base">
                    {countryToFlag(hikerData.country)}
                  </span>
                  <span>{hikerData.country ?? '—'}</span>
                </div>

                <div
                  className={`inline-flex rounded-full px-3 py-1.5 text-sm ${getDivisionBadgeClass(
                    hikerData.division
                  )}`}
                >
                  {hikerData.division ?? 'unranked'}
                </div>

                {hikerData.claimed_profile ? (
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

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                    Rang Overall
                  </div>
                  <div className="mt-1 text-2xl font-bold text-white">
                    {overallRank ? `#${overallRank}` : '—'}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                    Rang Division
                  </div>
                  <div className="mt-1 text-2xl font-bold text-white">
                    {divisionRank ? `#${divisionRank}` : '—'}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                    Gesamt-km
                  </div>
                  <div className="mt-1 text-2xl font-bold text-white">
                    {hikerData.total_km ?? 0} km
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                    Ø Speed
                  </div>
                  <div className="mt-1 text-2xl font-bold text-white">
                    {formatSpeed(hikerData.avg_speed)}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                    Höhenmeter
                  </div>
                  <div className="mt-1 text-2xl font-bold text-white">
                    {Math.round(totalElevation).toLocaleString('de-DE')} hm
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                    Skyscraper
                  </div>
                  <div className="mt-1 text-2xl font-bold text-white">
                    {hasSkyscraper ? 'Aktiv' : 'Noch offen'}
                  </div>
                </div>
              </div>
            </div>

            <div>
              {!hikerData.claimed_profile ? (
                <ClaimProfilePanel
                  hikerId={hikerData.id}
                  profileName={hikerData.display_name}
                />
              ) : (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-3 text-sm font-medium text-emerald-200">
                  <div>Verifiziert</div>
                  <div className="text-xs text-emerald-300/80">
                    Dieses Profil wurde übernommen
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Leistungen</h2>
            <div className="text-sm text-stone-400">
              {recordsData?.length ?? 0} Einträge
            </div>
          </div>

          {recordsError && (
            <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
              Fehler beim Laden der Einträge 😢
            </div>
          )}

          {!recordsData || recordsData.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-stone-400">
              Noch keine Einträge vorhanden.
            </div>
          ) : (
            <div className="space-y-3">
              {recordsData.map((record) => {
                const event = eventsMap.get(record.event_id)

                return (
                  <div
                    key={record.id}
                    className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/10"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 text-sm text-stone-500">
                          {formatDate(event?.event_date ?? record.activity_date)}
                        </div>

                        <div className="text-lg font-semibold text-white">
                          {getEventDisplayName(event)}
                        </div>

                        <div className="mt-1 text-sm text-stone-400">
                          {event ? (
                            <>
                              <span className="inline-flex items-center gap-1">
                                {countryToFlag(event?.country) && (
                                  <span className="text-base">
                                    {countryToFlag(event?.country)}
                                  </span>
                                )}
                                <span>{event?.country ?? '—'}</span>
                              </span>{' '}
                              · {event?.location ?? '—'} · {event?.organizer ?? '—'}
                            </>
                          ) : (
                            <span>Ohne offizielles Event</span>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          {event?.event_type && (
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-stone-300">
                              {event.event_type}
                            </span>
                          )}

                          {event?.is_walking_backyard && (
                            <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2 py-1 text-sky-200">
                              Backyard
                            </span>
                          )}

                          {record.record_status && (
                            <span
                              className={`rounded-full px-2 py-1 ${getRecordStatusClass(
                                record.record_status
                              )}`}
                            >
                              {record.record_status}
                            </span>
                          )}

                          {record.is_corrected && (
                            <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-2 py-1 text-orange-200">
                              korrigiert
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid min-w-[220px] grid-cols-2 gap-3 md:w-[420px]">
                        <div className="rounded-2xl border border-white/8 bg-black/10 p-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                            Distanz
                          </div>
                          <div className="font-semibold text-white">
                            {record.distance_km ?? '—'} km
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/8 bg-black/10 p-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                            Zeit
                          </div>
                          <div className="font-semibold text-white">
                            {formatTime(record.time_text)}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/8 bg-black/10 p-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                            Geschwindigkeit
                          </div>
                          <div className="font-semibold text-white">
                            {formatSpeed(record.avg_speed)}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/8 bg-black/10 p-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                            Tagesform
                          </div>
                          <div>
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium ${getDivisionBadgeClass(
                                record.division
                              )}`}
                            >
                              {record.division ?? '—'}
                            </span>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/8 bg-black/10 p-3 col-span-2">
                          <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                            Höhenmeter
                          </div>
                          <div className="font-semibold text-white">
                            {typeof record.elevation_gain === 'number'
                              ? `${Math.round(record.elevation_gain).toLocaleString('de-DE')} hm`
                              : '—'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <CorrectionRequestForm
                      recordId={record.id}
                      hikerId={hikerData.id}
                      currentDistance={record.distance_km}
                      currentTimeText={record.time_text}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}