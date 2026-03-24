import Link from 'next/link'
import { supabase } from '../../lib/supabase'

export const dynamic = 'force-dynamic'

type EventRow = {
  id: number
  event_name: string | null
  event_date: string | null
  location: string | null
  country: string | null
  official_distance_km: number | null
}

type RecordRow = {
  id: number
  hiker_id: number | null
  event_id: number | null
  distance_km: number | null
  time_text: string | null
  time_hours: number | null
  division: 'platinum' | 'gold' | 'silver' | null
  verified: boolean | null
  activity_date: string | null
}

type HikerRow = {
  id: number
  display_name: string | null
  country: string | null
}

type RankingEntry = {
  recordId: number
  hikerId: number
  name: string
  countryCode: string
  distanceLabel: string
  time: string | null
  timeHours: number | null
  division: 'platinum' | 'gold' | 'silver'
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getEventSlug(eventName: string | null, eventDate: string | null) {
  const safeName = slugify(eventName ?? 'event')
  const year = eventDate ? new Date(eventDate).getFullYear() : 'unknown'
  return `${safeName}-${year}`
}

function countryToFlag(countryCode: string | null) {
  if (!countryCode) return ''
  const code = countryCode.trim().toUpperCase()
  if (code.length !== 2) return ''
  return String.fromCodePoint(
    ...[...code].map((char) => 127397 + char.charCodeAt(0))
  )
}

function getDivisionBadgeClass(division: 'platinum' | 'gold' | 'silver') {
  switch (division) {
    case 'platinum':
      return 'border border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-200'
    case 'gold':
      return 'border border-yellow-400/30 bg-yellow-400/10 text-yellow-200'
    case 'silver':
    default:
      return 'border border-slate-300/30 bg-slate-300/10 text-slate-200'
  }
}

function formatDate(dateText: string | null) {
  if (!dateText) return '—'
  return new Date(dateText).toLocaleDateString('de-DE')
}

function formatDistance(distance: number | null) {
  if (distance === null || distance === undefined) return '—'
  return `${distance} km`
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const { data: allEvents, error: eventsError } = await supabase
    .from('events')
    .select('id, event_name, event_date, location, country, official_distance_km')
    .order('event_date', { ascending: true })

  if (eventsError || !allEvents || allEvents.length === 0) {
    return (
      <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/"
            className="text-sm text-stone-400 transition hover:text-white"
          >
            ← Zurück zur Startseite
          </Link>

          <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8">
            <h1 className="text-3xl font-bold text-white">Events konnten nicht geladen werden</h1>
            <p className="mt-3 text-stone-400">
              Bitte versuche es später erneut.
            </p>
          </div>
        </div>
      </main>
    )
  }

  const matchingEvents = (allEvents as EventRow[]).filter(
    (event) => getEventSlug(event.event_name, event.event_date) === slug
  )

  if (matchingEvents.length === 0) {
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
              Für diesen Link gibt es aktuell noch keine passende Event-Seite.
            </p>
          </div>
        </div>
      </main>
    )
  }

  const eventHeader = matchingEvents[0]
  const eventIds = matchingEvents.map((event) => event.id)

  const { data: recordRows } = await supabase
    .from('records')
    .select(
      'id, hiker_id, event_id, distance_km, time_text, time_hours, division, verified, activity_date'
    )
    .in('event_id', eventIds)

  const hikerIds = Array.from(
    new Set(
      (recordRows ?? [])
        .map((record) => record.hiker_id)
        .filter((id): id is number => typeof id === 'number')
    )
  )

  const { data: hikerRows } =
    hikerIds.length > 0
      ? await supabase
          .from('hikers')
          .select('id, display_name, country')
          .in('id', hikerIds)
      : { data: [] as HikerRow[] }

  const hikersMap = new Map(
    ((hikerRows ?? []) as HikerRow[]).map((hiker) => [hiker.id, hiker])
  )

  const distanceGroups = [...matchingEvents]
    .sort(
      (a, b) => (a.official_distance_km ?? 0) - (b.official_distance_km ?? 0)
    )
    .map((event) => {
      const distanceLabel = formatDistance(event.official_distance_km)

      const entries: RankingEntry[] = ((recordRows ?? []) as RecordRow[])
        .filter(
          (record) =>
            record.event_id === event.id &&
            record.verified === true &&
            typeof record.hiker_id === 'number'
        )
        .map((record) => {
          const hiker = hikersMap.get(record.hiker_id as number)
          return {
            recordId: record.id,
            hikerId: record.hiker_id as number,
            name: hiker?.display_name ?? 'Unbekannter Hiker',
            countryCode: hiker?.country ?? '',
            distanceLabel,
            time: record.time_text ?? null,
            timeHours: record.time_hours ?? null,
            division:
              record.division === 'platinum' ||
              record.division === 'gold' ||
              record.division === 'silver'
                ? record.division
                : 'silver',
          }
        })

      const timed = entries
        .filter((entry) => entry.time && entry.timeHours !== null)
        .sort((a, b) => (a.timeHours ?? 999999) - (b.timeHours ?? 999999))

      const finishers = entries
        .filter((entry) => !entry.time || entry.timeHours === null)
        .sort((a, b) => a.name.localeCompare(b.name, 'de'))

      return {
        eventId: event.id,
        distanceLabel,
        timed,
        finishers,
      }
    })

  const allDistances = distanceGroups.map((group) => group.distanceLabel)

  return (
    <main className="min-h-screen bg-[#141312] text-stone-100">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="/mountain-hero.jpg"
            alt={eventHeader.event_name ?? 'Event'}
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
              <span className="text-2xl">
                {countryToFlag(eventHeader.country ?? null)}
              </span>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs uppercase tracking-[0.18em] text-stone-300">
                Event
              </span>
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-white md:text-6xl">
              {eventHeader.event_name ?? 'Unbekanntes Event'}
            </h1>

            <p className="mt-4 max-w-2xl text-lg text-stone-200">
              Echte Eventdaten aus der Liga mit verifizierten Teilnehmern und
              klickbaren Profilen.
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
                  Ort
                </div>
                <div className="mt-2 font-semibold text-white">
                  {eventHeader.location ?? '—'}
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Land
                </div>
                <div className="mt-2 font-semibold text-white">
                  {eventHeader.country ?? '—'}
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Datum
                </div>
                <div className="mt-2 font-semibold text-white">
                  {formatDate(eventHeader.event_date)}
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Distanzen
                </div>
                <div className="mt-2 font-semibold text-white">
                  {allDistances.join(' · ') || '—'}
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                Nächster Ausbauschritt
              </div>
              <div className="mt-2 text-sm leading-6 text-stone-300">
                Als Nächstes erweitern wir diese echte Eventstruktur um
                Buchungslink, Affiliate-Link und Admin-Erstellung neuer Events.
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
              {allDistances.map((distance) => (
                <div
                  key={distance}
                  className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4 transition hover:border-white/15 hover:bg-white/[0.05]"
                >
                  <div className="text-lg font-semibold text-white">{distance}</div>
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
                Echte verifizierte Teilnehmer mit Zeitwertung und weiteren Finishers.
              </p>
            </div>

            <div className="hidden text-xs uppercase tracking-[0.2em] text-stone-500 md:block">
              Ranking
            </div>
          </div>

          <div className="space-y-8">
            {distanceGroups.map((group) => (
              <div
                key={`${group.eventId}-${group.distanceLabel}`}
                className="rounded-[1.75rem] border border-white/8 bg-black/10 p-5"
              >
                <div className="mb-5">
                  <h3 className="text-xl font-bold text-white">{group.distanceLabel}</h3>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div>
                    <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">
                      Ranking
                    </div>

                    {group.timed.length > 0 ? (
                      <div className="space-y-3">
                        {group.timed.slice(0, 10).map((entry, index) => (
                          <Link
                            key={`${entry.recordId}-timed`}
                            href={`/${entry.hikerId}`}
                            className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-4 transition-all duration-300 hover:border-white/15 hover:bg-white/[0.06] md:flex-row md:items-center md:justify-between"
                          >
                            <div className="flex min-w-0 items-center gap-4">
                              <div className="w-8 text-lg font-semibold text-white">
                                {index + 1}.
                              </div>

                              <div className="text-lg">
                                {countryToFlag(entry.countryCode)}
                              </div>

                              <div className="min-w-0">
                                <div className="truncate font-semibold text-white">
                                  {entry.name}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 md:justify-end">
                              <div className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-sm text-stone-200">
                                Zeit {entry.time}
                              </div>

                              <div
                                className={`rounded-full px-3 py-1 text-xs ${getDivisionBadgeClass(
                                  entry.division
                                )}`}
                              >
                                {entry.division}
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-4 text-sm text-stone-400">
                        Noch keine verifizierten Zeitwertungen für diese Distanz hinterlegt.
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
                          <Link
                            key={`${entry.recordId}-finisher`}
                            href={`/${entry.hikerId}`}
                            className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-4 transition-all duration-300 hover:border-white/15 hover:bg-white/[0.06] md:flex-row md:items-center md:justify-between"
                          >
                            <div className="flex min-w-0 items-center gap-4">
                              <div className="text-lg">
                                {countryToFlag(entry.countryCode)}
                              </div>

                              <div className="min-w-0">
                                <div className="truncate font-semibold text-white">
                                  {entry.name}
                                </div>
                              </div>
                            </div>

                            <div
                              className={`rounded-full px-3 py-1 text-xs ${getDivisionBadgeClass(
                                entry.division
                              )}`}
                            >
                              {entry.division}
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-4 text-sm text-stone-400">
                        Keine weiteren verifizierten Finisher ohne Zeit für diese Distanz.
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