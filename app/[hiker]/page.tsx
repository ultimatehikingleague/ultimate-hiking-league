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

function normalizeCountryCode(input: string | null | undefined) {
  const value = (input ?? '').trim().toLowerCase()

  if (!value) return ''

  const map: Record<string, string> = {
    de: 'DE',
    deutschland: 'DE',
    germany: 'DE',

    at: 'AT',
    österreich: 'AT',
    oesterreich: 'AT',
    austria: 'AT',

    ch: 'CH',
    schweiz: 'CH',
    switzerland: 'CH',
    suisse: 'CH',

    es: 'ES',
    spanien: 'ES',
    spain: 'ES',

    fr: 'FR',
    frankreich: 'FR',
    france: 'FR',

    it: 'IT',
    italien: 'IT',
    italy: 'IT',

    be: 'BE',
    belgien: 'BE',
    belgium: 'BE',

    nl: 'NL',
    niederlande: 'NL',
    netherlands: 'NL',
    holland: 'NL',

    lu: 'LU',
    luxemburg: 'LU',
    luxembourg: 'LU',

    li: 'LI',
    liechtenstein: 'LI',

    cz: 'CZ',
    tschechien: 'CZ',
    czechia: 'CZ',
    'czech republic': 'CZ',

    hu: 'HU',
    ungarn: 'HU',
    hungary: 'HU',

    gb: 'GB',
    uk: 'GB',
    england: 'GB',
    grossbritannien: 'GB',
    großbritannien: 'GB',
    'united kingdom': 'GB',

    pl: 'PL',
    polen: 'PL',
    poland: 'PL',

    pt: 'PT',
    portugal: 'PT',

    hr: 'HR',
    kroatien: 'HR',
    croatia: 'HR',

    si: 'SI',
    slowenien: 'SI',
    slovenia: 'SI',

    sk: 'SK',
    slowakei: 'SK',
    slovakia: 'SK',

    ru: 'RU',
    russland: 'RU',
    russia: 'RU',

    ua: 'UA',
    ukraine: 'UA',
  }

  return map[value] ?? (value.length === 2 ? value.toUpperCase() : '')
}

function countryToFlag(country: string | null | undefined) {
  const code = normalizeCountryCode(country)

  if (code.length !== 2) return ''

  return String.fromCodePoint(
    ...[...code].map((char) => 127397 + char.charCodeAt(0))
  )
}

function getEventDisplayName(
  event: any,
  record: {
    custom_title?: string | null
  }
) {
  if (event?.title && event.title.trim() !== '') {
    return event.title
  }

  if (record?.custom_title && record.custom_title.trim() !== '') {
    return record.custom_title
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

  const allHikers = await fetchAllRankedHikers()

  const rankedHikers = allHikers.filter(
    (entry) =>
      typeof entry.id === 'number' &&
      typeof entry.total_km === 'number' &&
      entry.total_km > 0
  )

  const overallIndex = rankedHikers.findIndex(
    (entry) => entry.id === hikerData.id
  )

  const overallRank = overallIndex >= 0 ? overallIndex + 1 : null

  const sameDivision = rankedHikers.filter(
    (entry) => entry.division === hikerData.division
  )

  const divisionIndex = sameDivision.findIndex(
    (entry) => entry.id === hikerData.id
  )

  const divisionRank = divisionIndex >= 0 ? divisionIndex + 1 : null

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
        event_master_id,
        is_corrected,
        elevation_gain,
        custom_title,
        custom_location,
        custom_country
      `
  )
  .eq('hiker_id', hiker)
  .order('activity_date', { ascending: false })

  const eventIds =
    recordsData?.map((record) => record.event_master_id).filter(Boolean) ?? []

  const { data: eventsData } =
    eventIds.length > 0
      ? await supabase
          .from('events_master')
          .select(
            'id, title, event_date, city, country, brand'
          )
          .in('id', eventIds)
      : { data: [] as any[] }

  const eventsMap = new Map((eventsData ?? []).map((event) => [event.id, event]))

  const totalElevation =
    recordsData?.reduce((sum, record) => {
      return sum + (typeof record.elevation_gain === 'number' ? record.elevation_gain : 0)
    }, 0) ?? 0

  const hasSkyscraper = totalElevation >= SKYSCRAPER_THRESHOLD

  type RankedHiker = {
  id: number
  total_km: number | null
  division: string | null
  display_name: string | null
}

async function fetchAllRankedHikers(): Promise<RankedHiker[]> {
  const pageSize = 1000
  let from = 0
  let allRows: RankedHiker[] = []

  while (true) {
    const { data, error } = await supabase
      .from('hikers')
      .select('id, total_km, division, display_name')
      .order('total_km', { ascending: false })
      .order('display_name', { ascending: true })
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
                    Ø Geschwindigkeit
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
                const event = eventsMap.get(record.event_master_id)

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
                          {getEventDisplayName(event, record)}
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
                              · {event?.city ?? '—'} · {event?.brand ?? '—'}
                            </>
                          ) : (
                            <>
                              <span className="inline-flex items-center gap-1">
                                {countryToFlag(record.custom_country ?? null) && (
                                  <span className="text-base">
                                    {countryToFlag(record.custom_country ?? null)}
                                  </span>
                                )}
                                <span>{record.custom_country ?? '—'}</span>
                              </span>{' '}
                              · {record.custom_location ?? '—'}
                            </>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          

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
                      isOfficialEvent={!!record.event_master_id}
                      initialActivityName={
                        event?.title ??
                        record.custom_title ??
                        ''
                      }
                      initialActivityDate={
                        event?.event_date ??
                        record.activity_date ??
                        ''
                      }
                      initialOfficialDistanceKm={record.distance_km}
                      initialActualDistanceKm={record.distance_km}
                      initialElapsedTimeText={record.time_text}
                      initialElevationGain={record.elevation_gain}
                      initialCountry={
                        event?.country ??
                        record.custom_country ??
                        ''
                      }
                      initialLocation={
                        event?.city ??
                        record.custom_location ??
                        ''
                      }
                      initialRecordSource={
                        event?.brand ??
                        ''
                      }
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