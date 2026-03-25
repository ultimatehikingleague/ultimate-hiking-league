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
    description: 'Großer internationaler Saisonstart.',
    deadline: 'Noch offen',
    surface: 'Urban / Trail',
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
    description: 'Insel-Event mit Community-Fokus.',
    deadline: 'Noch offen',
    surface: 'Straße / Promenade',
    format: 'Tagesevent',
  }
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