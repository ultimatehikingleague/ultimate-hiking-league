import Link from 'next/link'

export const dynamic = 'force-dynamic'

type EventDistance = {
  id: number
  distance_km: number
  label: string | null
}

type EventDetail = {
  id: number
  slug: string
  title: string
  city: string | null
  country: string | null
  country_code: string | null
  event_date: string | null
  brand: string | null
  description: string | null
  deadline_text: string | null
  surface: string | null
  format: string | null
  event_distances: EventDistance[]
}

type RecordRow = {
  id: number
  hiker_id: number | null
  event_distance_id: number | null
  time_text: string | null
  time_hours: number | null
  verified: boolean | null
  record_status: string | null
}

type HikerRow = {
  id: number
  display_name: string | null
  country: string | null
}

function countryToFlag(countryCode?: string | null) {
  if (!countryCode) return ''
  const code = countryCode.trim().toUpperCase()
  if (code.length !== 2) return ''
  return String.fromCodePoint(
    ...[...code].map((char) => 127397 + char.charCodeAt(0))
  )
}

function formatDate(dateString?: string | null) {
  if (!dateString) return 'Noch offen'
  return new Date(dateString).toLocaleDateString('de-DE')
}

function getHikerName(hikerId: number | null, hikersMap: Map<number, HikerRow>) {
  if (hikerId === null) return 'Unbekannter Hiker'
  return hikersMap.get(hikerId)?.display_name || `Hiker ${hikerId}`
}

function getHikerCountry(hikerId: number | null, hikersMap: Map<number, HikerRow>) {
  if (hikerId === null) return null
  return hikersMap.get(hikerId)?.country || null
}

async function fetchFromSupabase(path: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Supabase environment variables are missing.')
  }

  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText)
  }

  return response.json()
}

async function getEventBySlug(slug: string): Promise<EventDetail | null> {
  const rows = await fetchFromSupabase(
    `events_master?select=id,slug,title,city,country,country_code,event_date,brand,description,deadline_text,surface,format,event_distances(id,distance_km,label)&slug=eq.${encodeURIComponent(
      slug
    )}`
  )

  return rows[0] ?? null
}

async function getEventRecords(eventMasterId: number): Promise<RecordRow[]> {
  return fetchFromSupabase(
    `records?select=id,hiker_id,event_distance_id,time_text,time_hours,verified,record_status&event_master_id=eq.${eventMasterId}&order=time_hours.asc.nullslast`
  )
}

async function getHikersMap(hikerIds: number[]): Promise<Map<number, HikerRow>> {
  if (hikerIds.length === 0) {
    return new Map()
  }

  const uniqueIds = Array.from(new Set(hikerIds))
  const rows: HikerRow[] = await fetchFromSupabase(
    `hikers?select=id,display_name,country&id=in.(${uniqueIds.join(',')})`
  )

  return new Map(rows.map((row) => [row.id, row]))
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const event = await getEventBySlug(slug)

  if (!event) {
    return (
      <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap gap-4">
            <Link
              href="/"
              className="text-sm text-stone-400 transition hover:text-white"
            >
              ← Zurück zur Startseite
            </Link>

            <Link
              href="/events"
              className="text-sm text-stone-400 transition hover:text-white"
            >
              ← Zurück zu Events
            </Link>
          </div>

          <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8">
            <h1 className="text-3xl font-bold text-white">Event nicht gefunden</h1>
            <p className="mt-3 text-stone-400">
              Für diesen Link gibt es aktuell noch keine Event-Detailseite.
            </p>
          </div>
        </div>
      </main>
    )
  }

  const records = await getEventRecords(event.id)
  const hikerIds = records
    .map((record) => record.hiker_id)
    .filter((id): id is number => typeof id === 'number')

  const hikersMap = await getHikersMap(hikerIds)

  const groupedByDistance = (event.event_distances ?? [])
    .slice()
    .sort((a, b) => a.distance_km - b.distance_km)
    .map((distance) => {
      const entries = records.filter(
        (record) => record.event_distance_id === distance.id
      )

      const timed = entries
        .filter(
          (record) =>
            record.verified === true &&
            record.time_hours !== null &&
            !!record.time_text
        )
        .sort((a, b) => {
          const aValue = a.time_hours ?? Number.MAX_SAFE_INTEGER
          const bValue = b.time_hours ?? Number.MAX_SAFE_INTEGER
          return aValue - bValue
        })

      const finishers = entries
        .filter(
          (record) =>
            !(
              record.verified === true &&
              record.time_hours !== null &&
              !!record.time_text
            )
        )
        .sort((a, b) => {
          const nameA = getHikerName(a.hiker_id, hikersMap)
          const nameB = getHikerName(b.hiker_id, hikersMap)
          return nameA.localeCompare(nameB, 'de')
        })

      return {
        distance: distance.label || `${distance.distance_km} km`,
        timed,
        finishers,
      }
    })

  return (
    <main className="min-h-screen bg-[#141312] text-stone-100">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="/mountain-hero.jpg"
            alt={event.title}
            className="h-full w-full object-cover object-[58%_20%]"
          />
        </div>

        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,10,14,0.30)_0%,rgba(10,12,16,0.55)_30%,rgba(12,12,12,0.78)_68%,#141312_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent to-[#141312]" />

        <div className="relative z-10 mx-auto max-w-6xl px-6 pb-16 pt-12 md:px-10 md:pb-24 md:pt-16">
          <div className="flex flex-wrap gap-4">
            <Link
              href="/"
              className="inline-block rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-stone-200 transition hover:border-white/20 hover:bg-white/10"
            >
              ← Zurück zur Startseite
            </Link>

            <Link
              href="/events"
              className="inline-block rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-stone-200 transition hover:border-white/20 hover:bg-white/10"
            >
              ← Zurück zu Events
            </Link>
          </div>

          <div className="mt-10 max-w-4xl">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="text-2xl">{countryToFlag(event.country_code)}</span>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs uppercase tracking-[0.18em] text-stone-300">
                {event.brand ?? 'Event'}
              </span>
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-white md:text-6xl">
              {event.title}
            </h1>

            <p className="mt-4 max-w-2xl text-lg text-stone-200">
              {event.description ?? 'Für dieses Event folgen bald weitere Details.'}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 pb-12 md:px-10">
        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/10 backdrop-blur-sm">
            <div className="mb-5">
              <h2 className="text-2xl font-bold text-white">Event-Details</h2>
              <p className="mt-1 text-sm text-stone-400">
                Alle Eckdaten für dieses Event auf einen Blick.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Stadt
                </div>
                <div className="mt-2 font-semibold text-white">
                  {event.city ?? 'Noch offen'}
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Land
                </div>
                <div className="mt-2 font-semibold text-white">
                  {event.country ?? 'Noch offen'}
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Datum
                </div>
                <div className="mt-2 font-semibold text-white">
                  {formatDate(event.event_date)}
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Format
                </div>
                <div className="mt-2 font-semibold text-white">
                  {event.format ?? 'Noch offen'}
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Untergrund
                </div>
                <div className="mt-2 font-semibold text-white">
                  {event.surface ?? 'Noch offen'}
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Meldeschluss
                </div>
                <div className="mt-2 font-semibold text-white">
                  {event.deadline_text ?? 'Noch offen'}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-gradient-to-b from-[#26231f] to-[#1c1a17] p-6 shadow-xl shadow-black/20 backdrop-blur-sm">
            <div className="mb-5">
              <h2 className="text-2xl font-bold text-white">Distanzen</h2>
              <p className="mt-1 text-sm text-stone-400">
                Wertungsrelevante Strecken dieses Events.
              </p>
            </div>

            <div className="space-y-3">
              {groupedByDistance.map((group) => (
                <div
                  key={group.distance}
                  className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4 transition hover:border-white/15 hover:bg-white/[0.05]"
                >
                  <div className="text-lg font-semibold text-white">
                    {group.distance}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <Link
                href="/events"
                className="inline-block rounded-2xl bg-stone-100 px-5 py-3 text-sm font-medium text-stone-950 transition hover:-translate-y-0.5 hover:bg-white"
              >
                Zurück zur Event-Übersicht
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/10 backdrop-blur-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Event-Ranking</h2>
              <p className="mt-1 text-sm text-stone-400">
                Nur verifizierte Zeiten erscheinen im Ranking. Weitere Finisher
                werden separat aufgeführt.
              </p>
            </div>

            <div className="hidden text-xs uppercase tracking-[0.2em] text-stone-500 md:block">
              Ranking
            </div>
          </div>

          <div className="space-y-8">
            {groupedByDistance.map((group) => (
              <div
                key={group.distance}
                className="rounded-[1.75rem] border border-white/8 bg-black/10 p-5"
              >
                <div className="mb-5">
                  <h3 className="text-xl font-bold text-white">{group.distance}</h3>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div>
                    <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">
                      Ranking
                    </div>

                    {group.timed.length > 0 ? (
                      <div className="space-y-3">
                        {group.timed.slice(0, 10).map((entry, index) => (
                          <div
                            key={`timed-${entry.id}`}
                            className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-4 transition-all duration-300 hover:border-white/15 hover:bg-white/[0.06] md:flex-row md:items-center md:justify-between"
                          >
                            <div className="flex min-w-0 items-center gap-4">
                              <div className="w-8 text-lg font-semibold text-white">
                                {index + 1}.
                              </div>

                              <div className="text-lg">
                                {countryToFlag(getHikerCountry(entry.hiker_id, hikersMap))}
                              </div>

                              <div className="min-w-0">
                                <div className="truncate font-semibold text-white">
                                  {getHikerName(entry.hiker_id, hikersMap)}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 md:justify-end">
                              <div className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-sm text-stone-200">
                                Zeit {entry.time_text}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-4 text-sm text-stone-400">
                        Noch keine verifizierten Zeiten für diese Distanz hinterlegt.
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">
                      Weitere Finisher
                    </div>

                    {group.finishers.length > 0 ? (
                      <div className="space-y-3">
                        {group.finishers.slice(0, 10).map((entry) => (
                          <div
                            key={`finisher-${entry.id}`}
                            className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-4 transition-all duration-300 hover:border-white/15 hover:bg-white/[0.06] md:flex-row md:items-center md:justify-between"
                          >
                            <div className="flex min-w-0 items-center gap-4">
                              <div className="text-lg">
                                {countryToFlag(getHikerCountry(entry.hiker_id, hikersMap))}
                              </div>

                              <div className="min-w-0">
                                <div className="truncate font-semibold text-white">
                                  {getHikerName(entry.hiker_id, hikersMap)}
                                </div>
                              </div>
                            </div>

                            <div className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-xs text-stone-300">
                              Finisher
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-4 text-sm text-stone-400">
                        Keine weiteren Finisher für diese Distanz.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}