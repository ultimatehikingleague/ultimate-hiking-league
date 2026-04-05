import Link from 'next/link'
import { supabase } from '../lib/supabase'

type SearchPageProps = {
  searchParams: Promise<{
    q?: string
  }>
}

type HikerResult = {
  id: number
  display_name: string | null
  country: string | null
  total_km: number | null
  division: string | null
}

type EventDistanceResult = {
  id: number
  distance_km: number | null
  label: string | null
}

type EventResult = {
  id: number
  slug: string
  title: string | null
  city: string | null
  country: string | null
  country_code: string | null
  event_date: string | null
  brand: string | null
  event_distances?: EventDistanceResult[]
}

function countryToFlag(countryCode: string | null) {
  if (!countryCode) return ''
  const code = countryCode.trim().toUpperCase()
  if (code.length !== 2) return ''
  return String.fromCodePoint(
    ...[...code].map((char) => 127397 + char.charCodeAt(0))
  )
}

function formatDate(dateText: string | null) {
  if (!dateText) return '—'
  return new Date(dateText).toLocaleDateString('de-DE')
}

function formatDistances(distances: EventDistanceResult[] | undefined) {
  if (!distances || distances.length === 0) return '—'

  return distances
    .slice()
    .sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0))
    .map((distance) => {
      if (distance.label && distance.label.trim()) {
        return distance.label
      }

      if (typeof distance.distance_km === 'number') {
        return `${distance.distance_km} km`
      }

      return null
    })
    .filter(Boolean)
    .join(' / ')
}

export default async function SearchPage({
  searchParams,
}: SearchPageProps) {
  const params = await searchParams
  const query = params.q?.trim() ?? ''

  const hikerPromise = query
    ? supabase
        .from('hikers')
        .select('id, display_name, country, total_km, division')
        .ilike('display_name', `%${query}%`)
        .order('total_km', { ascending: false })
        .limit(30)
    : Promise.resolve({ data: [] as HikerResult[] })

  const eventPromise = query
    ? supabase
        .from('events_master')
        .select(
          'id, slug, title, city, country, country_code, event_date, brand, event_distances(id, distance_km, label)'
        )
        .or(
          `title.ilike.%${query}%,city.ilike.%${query}%,country.ilike.%${query}%,brand.ilike.%${query}%`
        )
        .order('event_date', { ascending: true })
        .limit(30)
    : Promise.resolve({ data: [] as EventResult[] })

  const [{ data: hikers }, { data: events }] = await Promise.all([
    hikerPromise,
    eventPromise,
  ])

  return (
    <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="mb-6 inline-block text-sm text-stone-400 transition hover:text-white"
        >
          ← Zurück zur Startseite
        </Link>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/10">
          <div className="mb-6">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-stone-400">
              Suche
            </div>
            <h1 className="mt-2 text-3xl font-bold text-white md:text-4xl">
              Profile & Events finden
            </h1>
          </div>

          <form action="/search" method="get" className="mb-8">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                name="q"
                defaultValue={query}
                placeholder="Nach Hiker, Event, Ort oder Veranstalter suchen…"
                className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none placeholder:text-stone-500"
              />
              <button
                type="submit"
                className="rounded-2xl bg-stone-100 px-5 py-3 text-sm font-medium text-stone-950 transition hover:bg-white"
              >
                Suche
              </button>
            </div>
          </form>

          {!query ? (
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-stone-400">
              Gib einen Namen, ein Event, einen Ort oder einen Veranstalter ein.
            </div>
          ) : (
            <div className="space-y-8">
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">Profile</h2>
                  <div className="text-sm text-stone-500">
                    {(hikers ?? []).length} Treffer
                  </div>
                </div>

                {(hikers ?? []).length > 0 ? (
                  <div className="space-y-3">
                    {(hikers ?? []).map((hiker) => (
                      <Link
                        key={hiker.id}
                        href={`/${hiker.id}`}
                        className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/10 p-4 transition hover:border-white/20 hover:bg-white/[0.05]"
                      >
                        <div className="text-xl">
                          {countryToFlag(hiker.country) || '🥾'}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-white">
                            {hiker.display_name ?? 'Unbekannt'}
                          </div>
                          <div className="mt-1 text-sm text-stone-400">
                            {hiker.total_km ?? 0} km
                            {hiker.division ? ` · ${hiker.division}` : ''}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-stone-400">
                    Keine Profile gefunden.
                  </div>
                )}
              </section>

              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">Events</h2>
                  <div className="text-sm text-stone-500">
                    {(events ?? []).length} Treffer
                  </div>
                </div>

                {(events ?? []).length > 0 ? (
                  <div className="space-y-3">
                    {(events ?? []).map((event) => (
                      <Link
                        key={event.id}
                        href={`/events/${event.slug}`}
                        className="block rounded-2xl border border-white/10 bg-black/10 p-4 transition hover:border-white/20 hover:bg-white/[0.05]"
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-white">
                              {event.city ?? 'Unbekannter Ort'}
                              {event.brand ? ` · ${event.brand}` : ''}
                            </div>

                            <div className="mt-1 text-sm text-stone-400">
                              {event.title ?? 'Unbekanntes Event'}
                            </div>

                            <div className="mt-1 text-sm text-stone-400">
                              {countryToFlag(event.country_code)}{' '}
                              {event.country ?? '—'}
                            </div>
                          </div>

                          <div className="text-left md:text-right">
                            <div className="text-sm text-stone-300">
                              {formatDate(event.event_date)}
                            </div>
                            <div className="text-xs text-stone-500">
                              {formatDistances(event.event_distances)}
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-stone-400">
                    Keine Events gefunden.
                  </div>
                )}
              </section>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}