import Link from 'next/link'
import { supabase } from '../lib/supabase'

export const dynamic = 'force-dynamic'

type EventDistanceRow = {
  id: number
  label: string | null
  distance_km: number | null
}

type EventRow = {
  id: number
  slug: string
  title: string | null
  city: string | null
  country: string | null
  country_code: string | null
  event_date: string | null
  brand: string | null
  event_distances: EventDistanceRow[] | null
}

type EventItem = {
  id: number
  slug: string
  city: string
  country: string
  countryCode: string
  date: string
  distances: string
  brand: string
  special?: string
}

function getTodayStart() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function isUpcomingOrToday(eventDate?: string | null) {
  if (!eventDate) return false
  const date = new Date(eventDate)
  return date >= getTodayStart()
}

async function getEvents() {
  const { data, error } = await supabase
    .from('events_master')
    .select('id, slug, title, city, country, country_code, event_date, brand, event_distances(id, label, distance_km)')
    .order('event_date', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data as EventRow[]) ?? []
}

function countryToFlag(countryCode: string) {
  const code = countryCode.trim().toUpperCase()
  if (code.length !== 2) return ''
  return String.fromCodePoint(
    ...[...code].map((char) => 127397 + char.charCodeAt(0))
  )
}

function getBrand(event: EventRow) {
  if (event.brand) return event.brand

  const title = event.title?.toLowerCase() ?? ''

  if (title.includes('ultramarsch')) return 'Ultramarsch'
  if (title.includes('mammutmarsch')) return 'Mammutmarsch'
  if (title.includes('megamarsch')) return 'Megamarsch'

  return 'Event'
}

function mapEventToCard(event: EventRow): EventItem {
  return {
    id: event.id,
    slug: event.slug,
    city: event.city ?? '—',
    country: event.country ?? '—',
    countryCode: event.country_code ?? '',
    date: event.event_date
      ? new Date(event.event_date).toLocaleDateString('de-DE')
      : '—',
    distances:
      event.event_distances && event.event_distances.length > 0
        ? event.event_distances
            .slice()
            .sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0))
            .map((d) => d.label ?? `${d.distance_km} km`)
            .join(' / ')
        : '—',
    brand: getBrand(event),
    special:
      event.country_code && event.country_code !== 'DE'
        ? 'International'
        : undefined,
  }
}

function EventCard({ event }: { event: EventItem }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 shadow-xl shadow-black/10 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.08]">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-xl">
              {countryToFlag(event.countryCode)}
            </span>
            <h3 className="min-w-0 break-words text-xl font-bold text-white">
              {event.city}
            </h3>
          </div>

          <div className="mt-1 text-sm text-stone-400">{event.country}</div>
        </div>

        {event.brand && (
          <span className="inline-flex w-fit self-start rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs uppercase tracking-wide text-stone-200">
            {event.brand}
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
          <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
            Datum
          </div>
          <div className="mt-1 font-semibold text-white">{event.date}</div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
          <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
            Distanzen
          </div>
          <div className="mt-1 break-words font-semibold text-white">
            {event.distances}
          </div>
        </div>
      </div>

      {event.special ? (
        <div className="mt-4 inline-block rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">
          {event.special}
        </div>
      ) : null}

      <div className="mt-5">
        <Link
          href={`/events/${event.slug}`}
          className="inline-block rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-stone-100 transition hover:bg-white/10"
        >
          Event öffnen
        </Link>
      </div>
    </div>
  )
}

export default async function EventsPage() {
  const events = await getEvents()

  const upcomingEvents = events
    .filter((event) => isUpcomingOrToday(event.event_date))
    .map(mapEventToCard)

  return (
    <main className="min-h-screen bg-[#141312] text-stone-100">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="/mountain-hero.jpg"
            alt="Events hero background"
            className="h-full w-full object-cover object-[50%_20%]"
          />
        </div>

        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,10,14,0.28)_0%,rgba(10,12,16,0.48)_28%,rgba(12,12,12,0.74)_65%,#141312_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_30%)]" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent to-[#141312]" />

        <div className="relative z-10 mx-auto max-w-7xl px-6 pb-14 pt-10 md:px-10 md:pb-20 md:pt-14">
          <header>
            <div className="mb-0 flex justify-center">
              <img
                src="/ultimate-logo-transparent-weiss.png"
                alt="Ultimate Hiking League"
                className="h-[190px] w-[190px] object-contain opacity-95 drop-shadow-[0_0_24px_rgba(255,255,255,0.08)] md:h-[210px] md:w-[210px]"
              />
            </div>

            <div className="mx-auto max-w-5xl text-center">
              <div className="mb-0 text-sm font-semibold uppercase tracking-[0.30em] text-stone-200 md:text-base">
                Ultimate European Hiking League
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-white md:text-5xl">
                Events 2026
              </h1>

              <p className="mx-auto mt-5 max-w-3xl text-lg font-medium text-stone-200">
                Die nächsten Märsche, Highlights und Liga-Termine auf einen Blick.
              </p>
            </div>

            <div className="mt-6 flex justify-center">
              <Link
                href="/"
                className="inline-block rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-stone-200 transition hover:border-white/20 hover:bg-white/10"
              >
                ← Zurück zur Startseite
              </Link>
            </div>

            
          </header>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 pb-10 md:px-10">
        <section className="mb-12 rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.03] p-6 shadow-2xl shadow-black/20 backdrop-blur-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Kommende Events</h2>
              <p className="mt-1 text-sm text-stone-400">
                Nur aktuelle und zukünftige Events werden hier angezeigt.
              </p>
            </div>

            <div className="hidden text-xs uppercase tracking-[0.2em] text-stone-500 md:block">
              Events
            </div>
          </div>

          {upcomingEvents.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {upcomingEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4 text-sm text-stone-400">
              Aktuell sind keine kommenden Events hinterlegt.
            </div>
          )}
        </section>
      </div>
    </main>
  )
}