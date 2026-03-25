import Link from 'next/link'

type EventDetail = {
  slug: string
  title: string
  city: string
  country: string
  countryCode: string
  date: string
  distances: string[]
  brand: string
  description: string
  deadline: string
  surface: string
  format: string
}

type EventRankingEntry = {
  name: string
  countryCode: string
  distance: string
  time?: string | null
  division: 'platinum' | 'gold' | 'silver'
}

function countryToFlag(countryCode: string) {
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
      return 'border border-slate-300/30 bg-slate-300/10 text-slate-200'
  }
}

const eventDetails: EventDetail[] = [
  {
    slug: 'mammutmarsch-madrid-2026',
    title: 'Mammutmarsch Madrid 2026',
    city: 'Madrid',
    country: 'Spanien',
    countryCode: 'ES',
    date: '21.02.2026',
    distances: ['30 km', '50 km', '100 km'],
    brand: 'Mammutmarsch',
    description:
      'Großer internationaler Saisonstart mit mehreren Distanzen und starkem Liga-Potenzial.',
    deadline: 'Noch offen',
    surface: 'Asphalt / Parkwege / Urban Trail',
    format: 'Tagesevent',
  },
  {
    slug: 'mammutmarsch-leipzig-2026',
    title: 'Mammutmarsch Leipzig 2026',
    city: 'Leipzig',
    country: 'Deutschland',
    countryCode: 'DE',
    date: '07.03.2026',
    distances: ['30 km', '42 km', '55 km'],
    brand: 'Mammutmarsch',
    description:
      'Starker Frühjahrs-Marsch in Deutschland mit mehreren Wertungsdistanzen.',
    deadline: 'Noch offen',
    surface: 'Urban / Mischterrain',
    format: 'Tagesevent',
  },
  {
    slug: 'megamarsch-mallorca-2026',
    title: 'Megamarsch Mallorca 2026',
    city: 'Mallorca',
    country: 'Spanien',
    countryCode: 'ES',
    date: '21.02.2026',
    distances: ['50 km'],
    brand: 'Megamarsch',
    description:
      'Internationales Insel-Event mit starkem Community-Faktor und hohem Reiz für die Liga.',
    deadline: 'Noch offen',
    surface: 'Straße / Promenade / Inselterrain',
    format: 'Tagesevent',
  },
  {
    slug: 'megamarsch-dresden-2026',
    title: 'Megamarsch Dresden 2026',
    city: 'Dresden',
    country: 'Deutschland',
    countryCode: 'DE',
    date: '07.03.2026',
    distances: ['25 km', '50 km'],
    brand: 'Megamarsch',
    description:
      'Frühes Saison-Event mit guter Einsteiger- und Liga-Relevanz.',
    deadline: 'Noch offen',
    surface: 'Urban / Asphalt / Umland',
    format: 'Tagesevent',
  },
  {
    slug: 'mammutmarsch-muenchen-2026',
    title: 'Mammutmarsch München 2026',
    city: 'München',
    country: 'Deutschland',
    countryCode: 'DE',
    date: '14.03.2026',
    distances: ['30 km', '55 km'],
    brand: 'Mammutmarsch',
    description:
      'Beliebter deutscher Mammutmarsch mit solider Liga-Relevanz.',
    deadline: 'Noch offen',
    surface: 'Urban / Park / Asphalt',
    format: 'Tagesevent',
  },
  {
    slug: 'megamarsch-hamburg-2026',
    title: 'Megamarsch Hamburg 2026',
    city: 'Hamburg',
    country: 'Deutschland',
    countryCode: 'DE',
    date: '11.04.2026',
    distances: ['100 km'],
    brand: 'Megamarsch',
    description:
      'Klassischer 100-km-Fokus, stark für die Gesamtwertung und die Top Divisionen.',
    deadline: 'Noch offen',
    surface: 'Urban / Asphalt',
    format: '24-Stunden-Challenge',
  },
  {
    slug: 'mammutmarsch-berlin-2026',
    title: 'Mammutmarsch Berlin 2026',
    city: 'Berlin',
    country: 'Deutschland',
    countryCode: 'DE',
    date: '16.05.2026',
    distances: ['75 km', '100 km'],
    brand: 'Mammutmarsch',
    description:
      'Eines der großen Liga-Highlights mit mehreren schweren Distanzen.',
    deadline: 'Noch offen',
    surface: 'Urban / Langdistanz',
    format: 'Tagesevent',
  },
  {
    slug: 'megamarsch-weserbergland-2026',
    title: 'Megamarsch Weserbergland 2026',
    city: 'Weserbergland',
    country: 'Deutschland',
    countryCode: 'DE',
    date: '13.06.2026',
    distances: ['100 km'],
    brand: 'Megamarsch',
    description:
      'Landschaftlich starkes Event mit echtem Abenteuer-Faktor.',
    deadline: 'Noch offen',
    surface: 'Mischterrain / Höhenmeter',
    format: '24-Stunden-Challenge',
  },
  {
    slug: 'mammutmarsch-kopenhagen-2026',
    title: 'Mammutmarsch Kopenhagen 2026',
    city: 'Kopenhagen',
    country: 'Dänemark',
    countryCode: 'DK',
    date: '15.08.2026',
    distances: ['75 km', '100 km'],
    brand: 'Mammutmarsch',
    description:
      'Internationales Event und spannend für die spätere Nationen-Wertung.',
    deadline: 'Noch offen',
    surface: 'Urban / Küstennah',
    format: 'Tagesevent',
  },
  {
    slug: 'megamarsch-ruegen-2026',
    title: 'Megamarsch Rügen 2026',
    city: 'Rügen',
    country: 'Deutschland',
    countryCode: 'DE',
    date: '17.10.2026',
    distances: ['100 km'],
    brand: 'Megamarsch',
    description:
      'Küsten- und Insel-Charakter, großes Potenzial für starke 100-km-Leistungen.',
    deadline: 'Noch offen',
    surface: 'Asphalt / Inselprofil',
    format: '24-Stunden-Challenge',
  },
]

const eventRankings: Record<string, EventRankingEntry[]> = {
  'mammutmarsch-madrid-2026': [
    { name: 'Thomas Bias', countryCode: 'DE', distance: '100 km', time: '15:42', division: 'platinum' },
    { name: 'Jore Schlag', countryCode: 'DE', distance: '100 km', time: '16:18', division: 'platinum' },
  ],
  'megamarsch-mallorca-2026': [
    { name: 'Jan Dreilich', countryCode: 'DE', distance: '50 km', time: '08:14', division: 'gold' },
  ],
}

export async function generateStaticParams() {
  return eventDetails.map((event) => ({
    slug: event.slug,
  }))
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const event = eventDetails.find((item) => item.slug === slug)
  const ranking = eventRankings[slug] ?? []

  if (!event) {
    return (
      <main className="min-h-screen bg-[#141312] p-10 text-white">
        Event nicht gefunden
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#141312] text-white p-10">
      <Link href="/events">← Zurück</Link>

      <h1 className="text-4xl font-bold mt-6">{event.title}</h1>

      <div className="mt-6 space-y-4">
        {event.distances.map((distance) => (
          <div key={distance}>
            <h2 className="text-xl font-bold">{distance}</h2>

            {ranking
              .filter((r) => r.distance === distance)
              .map((r, i) => (
                <div key={i} className="flex gap-4 mt-2">
                  <span>{i + 1}.</span>
                  <span>{countryToFlag(r.countryCode)}</span>
                  <span>{r.name}</span>
                  <span>{r.time ?? '—'}</span>
                </div>
              ))}
          </div>
        ))}
      </div>
    </main>
  )
}