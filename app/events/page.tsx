import Link from 'next/link'
import Nav from '../components/Nav'
import { supabase } from '../lib/supabase'

export const dynamic = 'force-dynamic'

type EventRow = {
  id: number
  event_name: string | null
  event_date: string | null
  location: string | null
  country: string | null
  official_distance_km: number | null
}

type EventItem = {
  slug: string
  city: string
  country: string
  countryCode: string
  date: string
  distances: string
  brand: string
  special?: string
}

function countryToFlag(countryCode: string | null) {
  if (!countryCode) return ''
  const code = countryCode.trim().toUpperCase()
  if (code.length !== 2) return ''
  return String.fromCodePoint(
    ...[...code].map((char) => 127397 + char.charCodeAt(0))
  )
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function stripDistanceFromEventName(name: string | null) {
  if (!name) return 'Event'
  return name
    .replace(/\s*\d+\s*km\b/gi, '')
    .replace(/\s*[-–—]\s*\d+\s*km\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildEventSlug(eventName: string | null, eventDate: string | null) {
  const baseName = stripDistanceFromEventName(eventName)
  const year = eventDate ? new Date(eventDate).getFullYear() : 'unknown'
  return slugify(`${baseName}-${year}`)
}


function EventCard({ event }: { event: EventItem }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 shadow-xl shadow-black/10 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.08]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-xl">{countryToFlag(event.countryCode)}</span>
            <h3 className="text-xl font-bold text-white">{event.city}</h3>
          </div>
          <div className="mt-1 text-sm text-stone-400">{event.country}</div>
        </div>

        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs uppercase tracking-[0.18em] text-stone-300">
          {event.brand}
        </span>
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
          <div className="mt-1 font-semibold text-white">{event.distances}</div>
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

function BrandList({
  title,
  subtitle,
  items,
}: {
  title: string
  subtitle: string
  items: string[]
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/10 backdrop-blur-sm">
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        <p className="mt-1 text-sm text-stone-400">{subtitle}</p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3 text-sm text-stone-200 transition hover:border-white/15 hover:bg-white/[0.05]"
          >
            {item}
          </div>
        ))}
      </div>
    </section>
  )
}

export default async function EventsPage() {
    const { data: events, error } = await supabase
    .from('events')
    .select('id, event_name, event_date, location, country, official_distance_km')
    .order('event_date', { ascending: true })

  if (error || !events) {
    return (
      <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-2xl font-bold text-white">
            Events konnten nicht geladen werden
          </h1>
        </div>
      </main>
    )
  }
    const grouped = new Map<string, EventRow[]>()

  for (const event of events as EventRow[]) {
    const slug = buildEventSlug(event.event_name, event.event_date)

    if (!grouped.has(slug)) {
      grouped.set(slug, [event])
    } else {
      grouped.get(slug)!.push(event)
    }
  }

  const groupedEvents = Array.from(grouped.entries()).map(([slug, rows]) => {
    const first = rows[0]

    return {
      slug,
      title: stripDistanceFromEventName(first.event_name),
      date: first.event_date,
      location: first.location,
      country: first.country,
      countryCode: first.country,
      distances: rows
        .map((r) => r.official_distance_km)
        .filter(Boolean)
        .sort((a, b) => (a ?? 0) - (b ?? 0)),
    }
  })
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

        <div className="relative z-10 mx-auto max-w-7xl px-6 pt-10 pb-14 md:px-10 md:pt-14 md:pb-20">
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

            <div className="mx-auto mt-8 max-w-7xl">
              <Nav />
            </div>
          </header>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 pb-10 md:px-10">
        <section className="mb-12 rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.03] p-6 shadow-2xl shadow-black/20 backdrop-blur-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Kommende Highlights</h2>
              <p className="mt-1 text-sm text-stone-400">
                Erste Vorschau auf starke Märsche und Event-Daten.
              </p>
            </div>

            <div className="hidden text-xs uppercase tracking-[0.2em] text-stone-500 md:block">
              Events
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {groupedEvents.map((event) => (
  <div
    key={event.slug}
    className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 shadow-xl shadow-black/10 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.08]"
  >
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-3">
          <span className="text-xl">
            {countryToFlag(event.countryCode)}
          </span>
          <h3 className="text-xl font-bold text-white">
            {event.title}
          </h3>
        </div>
        <div className="mt-1 text-sm text-stone-400">
          {event.country ?? '—'}
        </div>
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
        <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
          Datum
        </div>
        <div className="mt-1 font-semibold text-white">
          {event.date
            ? new Date(event.date).toLocaleDateString('de-DE')
            : '—'}
        </div>
      </div>

      <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
        <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
          Distanzen
        </div>
        <div className="mt-1 font-semibold text-white">
          {event.distances.map((d) => `${d} km`).join(' / ') || '—'}
        </div>
      </div>
    </div>

    <div className="mt-5">
      <Link
        href={`/events/${event.slug}`}
        className="inline-block rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-stone-100 transition hover:bg-white/10"
      >
        Event öffnen
      </Link>
    </div>
  </div>
))}
            
          </div>
        </section>

       
        
      
      </div>
    </main>
  )
}