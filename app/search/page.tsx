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

type EventResult = {
  id: number
  event_name: string | null
  location: string | null
  country: string | null
  event_date: string | null
  official_distance_km: number | null
}

function countryToFlag(country: string | null) {
  if (!country) return ''
  const code = country.trim().toUpperCase()
  if (code.length !== 2) return ''
  return String.fromCodePoint(
    ...[...code].map((char) => 127397 + char.charCodeAt(0))
  )
}

function formatDate(dateText: string | null) {
  if (!dateText) return '—'
  return new Date(dateText).toLocaleDateString('de-DE')
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
        .from('events')
        .select(
          'id, event_name, location, country, event_date, official_distance_km'
        )
        .or(
          `event_name.ilike.%${query}%,location.ilike.%${query}%,country.ilike.%${query}%`
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
                placeholder="Nach Hiker, Event oder Ort suchen…"
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
              Gib einen Namen, ein Event oder einen Ort ein.
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
                        href="/events"
                        className="block rounded-2xl border border-white/10 bg-black/10 p-4 transition hover:border-white/20 hover:bg-white/[0.05]"
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-white">
                              {event.event_name ?? 'Unbekanntes Event'}
                            </div>
                            <div className="mt-1 text-sm text-stone-400">
                              {countryToFlag(event.country)} {event.country ?? '—'}
                              {event.location ? ` · ${event.location}` : ''}
                            </div>
                          </div>

                          <div className="text-left md:text-right">
                            <div className="text-sm text-stone-300">
                              {formatDate(event.event_date)}
                            </div>
                            <div className="text-xs text-stone-500">
                              {event.official_distance_km ?? '—'} km
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