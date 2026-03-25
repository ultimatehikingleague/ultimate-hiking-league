import Link from 'next/link'
import Nav from '../components/Nav'

export const dynamic = 'force-dynamic'

async function getEvents() {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/events_master?select=*,event_distances(*)&order=event_date.asc`,
    {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
      cache: 'no-store',
    }
  )

  return res.json()
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

function countryToFlag(countryCode: string) {
  const code = countryCode.trim().toUpperCase()
  if (code.length !== 2) return ''
  return String.fromCodePoint(
    ...[...code].map((char) => 127397 + char.charCodeAt(0))
  )
}

const upcomingEvents: EventItem[] = [
  {
    slug: 'mammutmarsch-madrid-2026',
    city: 'Madrid',
    country: 'Spanien',
    countryCode: 'ES',
    date: '21.02.2026',
    distances: '30 / 50 / 100 km',
    brand: 'Mammutmarsch',
  },
  {
    slug: 'mammutmarsch-leipzig-2026',
    city: 'Leipzig',
    country: 'Deutschland',
    countryCode: 'DE',
    date: '07.03.2026',
    distances: '30 / 42 / 55 km',
    brand: 'Mammutmarsch',
  },
  {
    slug: 'megamarsch-mallorca-2026',
    city: 'Mallorca',
    country: 'Spanien',
    countryCode: 'ES',
    date: '21.02.2026',
    distances: '50 km',
    brand: 'Megamarsch',
  },
  {
    slug: 'megamarsch-dresden-2026',
    city: 'Dresden',
    country: 'Deutschland',
    countryCode: 'DE',
    date: '07.03.2026',
    distances: '25 / 50 km',
    brand: 'Megamarsch',
  },
  {
    slug: 'mammutmarsch-muenchen-2026',
    city: 'München',
    country: 'Deutschland',
    countryCode: 'DE',
    date: '14.03.2026',
    distances: '30 / 55 km',
    brand: 'Mammutmarsch',
  },
  {
    slug: 'megamarsch-hamburg-2026',
    city: 'Hamburg',
    country: 'Deutschland',
    countryCode: 'DE',
    date: '11.04.2026',
    distances: '100 km',
    brand: 'Megamarsch',
  },
  {
    slug: 'mammutmarsch-berlin-2026',
    city: 'Berlin',
    country: 'Deutschland',
    countryCode: 'DE',
    date: '16.05.2026',
    distances: '75 / 100 km',
    brand: 'Mammutmarsch',
  },
  {
    slug: 'megamarsch-weserbergland-2026',
    city: 'Weserbergland',
    country: 'Deutschland',
    countryCode: 'DE',
    date: '13.06.2026',
    distances: '100 km',
    brand: 'Megamarsch',
  },
  {
    slug: 'mammutmarsch-kopenhagen-2026',
    city: 'Kopenhagen',
    country: 'Dänemark',
    countryCode: 'DK',
    date: '15.08.2026',
    distances: '75 / 100 km',
    brand: 'Mammutmarsch',
    special: 'International',
  },
  {
    slug: 'megamarsch-ruegen-2026',
    city: 'Rügen',
    country: 'Deutschland',
    countryCode: 'DE',
    date: '17.10.2026',
    distances: '100 km',
    brand: 'Megamarsch',
  },
]

const mammutmarschEvents = [
  'Madrid · 21.02.2026 · 30 / 50 / 100 km',
  'Leipzig · 07.03.2026 · 30 / 42 / 55 km',
  'München · 14.03.2026 · 30 / 55 km',
  'Hamburg · 28.03.2026 · 30 / 50 km',
  'Wien · 11.04.2026 · 30 / 50 km',
  'Kopenhagen · 02.05.2026 · 30 / 42 / 55 km',
  'Berlin · 16.05.2026 · 75 / 100 km',
  'Dresden · 06.06.2026 · 30 / 50 km',
]

const megamarschEvents = [
  'Mallorca · 21.02.2026 · 50 km',
  'Dresden · 07.03.2026 · 25 / 50 km',
  'Mönchengladbach · 21.03.2026 · 50 km',
  'Luzern · 28.03.2026 · 50 km',
  'Ostsee · 25.04.2026 · 50 km',
  'Hannover · 02.05.2026 · 50 km',
  'München · 16.05.2026 · 100 km',
  'Rügen · 17.10.2026 · 100 km',
]

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
  const events = await getEvents()
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
            {events.map((event: any) => (
             <EventCard
               key={event.id}
               event={{
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
                        .map((d: any) => d.label ?? `${d.distance_km} km`)
                        .join(' / ')
                    : '—',
                 brand: event.brand ?? 'Event',
                 special: event.country_code && event.country_code !== 'DE' ? 'International' : undefined,
               }}
            />
          ))}

          </div>
        </section>

        
      </div>
    </main>
  )
}