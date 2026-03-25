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
    { name: 'Dirk Albers', countryCode: 'DE', distance: '100 km', time: null, division: 'gold' },
    { name: 'Jure Vranjkovic', countryCode: 'HR', distance: '50 km', time: '07:11', division: 'gold' },
    { name: 'Nicole Labonde', countryCode: 'DE', distance: '50 km', time: '07:54', division: 'gold' },
    { name: 'Kamil Lukas', countryCode: 'PL', distance: '50 km', time: null, division: 'silver' },
    { name: 'Stefan Seebach', countryCode: 'DE', distance: '30 km', time: '04:58', division: 'silver' },
    { name: 'Markus Birke', countryCode: 'DE', distance: '30 km', time: null, division: 'silver' },
  ],
  'mammutmarsch-leipzig-2026': [
    { name: 'Thomas Gossen', countryCode: 'DE', distance: '55 km', time: '08:01', division: 'platinum' },
    { name: 'Arnim Bolte', countryCode: 'DE', distance: '55 km', time: '08:20', division: 'platinum' },
    { name: 'Dennis Kühnert', countryCode: 'DE', distance: '55 km', time: null, division: 'gold' },
    { name: 'Claudia Gösche', countryCode: 'DE', distance: '42 km', time: '06:49', division: 'gold' },
    { name: 'Bianca Dörr', countryCode: 'DE', distance: '42 km', time: '07:05', division: 'gold' },
    { name: 'Mara Wenzel', countryCode: 'DE', distance: '42 km', time: null, division: 'silver' },
    { name: 'Markus Birke', countryCode: 'DE', distance: '30 km', time: '04:36', division: 'silver' },
  ],
  'megamarsch-mallorca-2026': [
    { name: 'Jan Dreilich', countryCode: 'DE', distance: '50 km', time: '08:14', division: 'gold' },
    { name: 'Dominik Großkinsky', countryCode: 'DE', distance: '50 km', time: '08:31', division: 'silver' },
    { name: 'Kamil Lukas', countryCode: 'PL', distance: '50 km', time: null, division: 'silver' },
    { name: 'Mila Roca', countryCode: 'ES', distance: '50 km', time: null, division: 'silver' },
  ],
  'megamarsch-dresden-2026': [
    { name: 'Marcel Parin', countryCode: 'DE', distance: '50 km', time: '08:03', division: 'platinum' },
    { name: 'Davor Bendin', countryCode: 'HR', distance: '50 km', time: '08:22', division: 'platinum' },
    { name: 'Janine Krüger', countryCode: 'DE', distance: '50 km', time: null, division: 'gold' },
    { name: 'Manuela Schöne', countryCode: 'DE', distance: '25 km', time: '03:45', division: 'silver' },
  ],
  'mammutmarsch-muenchen-2026': [
    { name: 'Claudia Gösche', countryCode: 'DE', distance: '55 km', time: '08:10', division: 'platinum' },
    { name: 'Dennis Kühnert', countryCode: 'DE', distance: '55 km', time: '08:41', division: 'gold' },
    { name: 'Thomas Weber', countryCode: 'DE', distance: '55 km', time: null, division: 'gold' },
    { name: 'Norbert Posselt', countryCode: 'DE', distance: '30 km', time: '04:22', division: 'silver' },
  ],
  'megamarsch-hamburg-2026': [
    { name: 'Thomas Bias', countryCode: 'DE', distance: '100 km', time: '14:58', division: 'platinum' },
    { name: 'Thomas Gossen', countryCode: 'DE', distance: '100 km', time: '15:21', division: 'platinum' },
    { name: 'Jore Schlag', countryCode: 'DE', distance: '100 km', time: '15:46', division: 'platinum' },
    { name: 'Arnim Bolte', countryCode: 'DE', distance: '100 km', time: null, division: 'gold' },
    { name: 'Stefan Seebach', countryCode: 'DE', distance: '100 km', time: null, division: 'silver' },
  ],
  'mammutmarsch-berlin-2026': [
    { name: 'Jan Dreilich', countryCode: 'DE', distance: '100 km', time: '15:03', division: 'platinum' },
    { name: 'Jure Vranjkovic', countryCode: 'HR', distance: '100 km', time: '15:48', division: 'platinum' },
    { name: 'Dirk Nielsen', countryCode: 'DK', distance: '100 km', time: null, division: 'gold' },
    { name: 'Bianca Dörr', countryCode: 'DE', distance: '75 km', time: '11:28', division: 'gold' },
    { name: 'Marek Hoff', countryCode: 'DE', distance: '75 km', time: null, division: 'silver' },
  ],
  'megamarsch-weserbergland-2026': [
    { name: 'Nicole Labonde', countryCode: 'DE', distance: '100 km', time: '16:40', division: 'gold' },
    { name: 'Ivonne Konrad', countryCode: 'DE', distance: '100 km', time: '17:15', division: 'gold' },
    { name: 'Swantje Möller', countryCode: 'DE', distance: '100 km', time: null, division: 'silver' },
  ],
  'mammutmarsch-kopenhagen-2026': [
    { name: 'Edgar Wendt', countryCode: 'DE', distance: '100 km', time: '15:58', division: 'gold' },
    { name: 'Lars Holm', countryCode: 'DK', distance: '100 km', time: null, division: 'gold' },
    { name: 'Marc Fischer', countryCode: 'DE', distance: '75 km', time: '11:51', division: 'silver' },
    { name: 'Jakob Lang', countryCode: 'DK', distance: '75 km', time: '12:06', division: 'silver' },
  ],
  'megamarsch-ruegen-2026': [
    { name: 'Michael Marx', countryCode: 'DE', distance: '100 km', time: '16:09', division: 'silver' },
    { name: 'Laszlo Peiml', countryCode: 'DE', distance: '100 km', time: '16:41', division: 'silver' },
    { name: 'Jens Greblan', countryCode: 'DE', distance: '100 km', time: null, division: 'silver' },
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

  const groupedByDistance = event.distances.map((distance) => {
    const entries = ranking.filter((entry) => entry.distance === distance)
    const timed = entries.filter((entry) => entry.time)
    const finishers = entries
      .filter((entry) => !entry.time)
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))

    return {
      distance,
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

        <div className="relative z-10 mx-auto max-w-6xl px-6 pt-12 pb-16 md:px-10 md:pt-16 md:pb-24">
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
              <span className="text-2xl">{countryToFlag(event.countryCode)}</span>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs uppercase tracking-[0.18em] text-stone-300">
                {event.brand}
              </span>
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-white md:text-6xl">
              {event.title}
            </h1>

            <p className="mt-4 max-w-2xl text-lg text-stone-200">
              {event.description}
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
                <div className="mt-2 font-semibold text-white">{event.city}</div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Land
                </div>
                <div className="mt-2 font-semibold text-white">{event.country}</div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Datum
                </div>
                <div className="mt-2 font-semibold text-white">{event.date}</div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Format
                </div>
                <div className="mt-2 font-semibold text-white">{event.format}</div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Untergrund
                </div>
                <div className="mt-2 font-semibold text-white">{event.surface}</div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Meldeschluss
                </div>
                <div className="mt-2 font-semibold text-white">{event.deadline}</div>
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
              {event.distances.map((distance) => (
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
                Ranking mit Zeit und zusätzliche Finisher ohne Zeitwertung.
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
                      <>
                        <div className="space-y-3">
                          {group.timed.slice(0, 10).map((entry, index) => (
                            <div
                              key={`${entry.name}-${entry.distance}-${entry.time}`}
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
                            </div>
                          ))}
                        </div>

                        {group.timed.length > 10 && (
                          <div className="pt-3">
                            <Link
                              href={`/events/${slug}/ranking?distance=${encodeURIComponent(group.distance)}`}
                              className="text-sm text-stone-300 underline transition hover:text-white"
                            >
                              Gesamte Rangliste anzeigen →
                            </Link>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-4 text-sm text-stone-400">
                        Noch keine Zeitwertungen für diese Distanz hinterlegt.
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">
                      Weitere Finisher
                    </div>

                    {group.finishers.length > 0 ? (
                      <>
                        <div className="space-y-3">
                          {group.finishers.slice(0, 10).map((entry) => (
                            <div
                              key={`${entry.name}-${entry.distance}-finisher`}
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
                            </div>
                          ))}
                        </div>

                        {group.finishers.length > 10 && (
                          <div className="pt-3">
                            <Link
                              href={`/events/${slug}/finishers?distance=${encodeURIComponent(group.distance)}`}
                              className="text-sm text-stone-300 underline transition hover:text-white"
                            >
                              Alle Finisher anzeigen →
                            </Link>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-4 text-sm text-stone-400">
                        Keine weiteren Finisher ohne Zeit für diese Distanz.
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