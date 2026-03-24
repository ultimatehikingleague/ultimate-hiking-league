import Link from 'next/link'
import { supabase } from './lib/supabase'
import Nav from './components/Nav'

export const dynamic = 'force-dynamic'

function countryToFlag(country: string | null) {
  if (!country) return ''
  const code = country.trim().toUpperCase()
  if (code.length !== 2) return ''
  return String.fromCodePoint(
    ...[...code].map((char) => 127397 + char.charCodeAt(0))
  )
}

function getDivisionBadgeClass(division: string | null) {
  switch (division) {
    case 'platinum':
      return 'border border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-200'
    case 'gold':
      return 'border border-yellow-400/30 bg-yellow-400/10 text-yellow-200'
    case 'silver':
      return 'border border-slate-300/30 bg-slate-300/10 text-slate-200'
    default:
      return 'border border-white/10 bg-white/5 text-stone-300'
  }
}

function getDivisionTitleClass(division: string) {
  switch (division) {
    case 'platinum':
      return 'text-fuchsia-200'
    case 'gold':
      return 'text-yellow-200'
    case 'silver':
      return 'text-slate-200'
    default:
      return 'text-white'
  }
}

function getDivisionDotClass(division: string) {
  switch (division) {
    case 'platinum':
      return 'bg-fuchsia-300'
    case 'gold':
      return 'bg-yellow-300'
    case 'silver':
      return 'bg-slate-200'
    default:
      return 'bg-white'
  }
}

function getEventDisplayName(event: { event_name?: string | null } | undefined) {
  if (event?.event_name && event.event_name.trim() !== '') {
    return event.event_name
  }
  return 'Privater Eintrag'
}

type HikerRow = {
  id: number
  display_name: string
  total_km: number | null
  division: string | null
  country: string | null
}

function RankingColumn({
  title,
  href,
  hikers,
  divisionStyle,
  divisionDotClass,
}: {
  title: string
  href: string
  hikers: HikerRow[]
  divisionStyle?: string
  divisionDotClass?: string
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/10 backdrop-blur-sm transition-all duration-300 hover:border-white/15 hover:bg-white/[0.07]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className={`flex items-center text-lg font-semibold ${divisionStyle ?? 'text-white'}`}>
          {divisionDotClass ? (
            <span className={`mr-2 inline-block h-4 w-4 rounded-full ${divisionDotClass}`} />
          ) : null}
          {title}
        </h3>

        <Link
          href={href}
          className="text-xs font-medium uppercase tracking-[0.18em] text-stone-400 transition hover:text-white"
        >
          Mehr
        </Link>
      </div>

      <div className="space-y-2">
        {hikers.map((hiker, index) => {
          const isTop3 = index < 3

          return (
            <Link
              key={hiker.id}
              href={`/${hiker.id}`}
              className={`flex items-center gap-3 rounded-2xl border px-3 py-3 transition-all duration-300 ${
                isTop3
                  ? 'border-white/12 bg-white/[0.07] hover:border-white/25 hover:bg-white/[0.11]'
                  : 'border-white/8 bg-black/10 hover:border-white/15 hover:bg-white/5'
              }`}
            >
              <div
                className={`w-7 text-sm font-semibold ${
                  isTop3 ? 'text-white' : 'text-stone-300'
                }`}
              >
                {index + 1}.
              </div>

              <div className="w-6 text-center text-base">
                {countryToFlag(hiker.country) || '—'}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-white">
                  {hiker.display_name}
                </div>
                <div className="text-xs text-stone-400">
                  {hiker.total_km ?? 0} km
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

export default async function Home() {
  const { data: globalData } = await supabase
    .from('hikers')
    .select('id, display_name, total_km, division, country')
    .order('total_km', { ascending: false })
    .limit(10)

  const { data: platinumData } = await supabase
    .from('hikers')
    .select('id, display_name, total_km, division, country')
    .eq('division', 'platinum')
    .order('total_km', { ascending: false })
    .limit(10)

  const { data: goldData } = await supabase
    .from('hikers')
    .select('id, display_name, total_km, division, country')
    .eq('division', 'gold')
    .order('total_km', { ascending: false })
    .limit(10)

  const { data: silverData } = await supabase
    .from('hikers')
    .select('id, display_name, total_km, division, country')
    .eq('division', 'silver')
    .order('total_km', { ascending: false })
    .limit(10)

  const { data: recentRecords } = await supabase
    .from('records')
    .select(
      'id, hiker_id, event_id, distance_km, division, activity_date, record_status, is_corrected'
    )
    .order('activity_date', { ascending: false })
    .limit(8)

  const recentHikerIds = Array.from(
    new Set((recentRecords ?? []).map((record) => record.hiker_id).filter(Boolean))
  )

  const recentEventIds = Array.from(
    new Set((recentRecords ?? []).map((record) => record.event_id).filter(Boolean))
  )

  const { data: recentHikers } =
    recentHikerIds.length > 0
      ? await supabase
          .from('hikers')
          .select('id, display_name, country')
          .in('id', recentHikerIds)
      : { data: [] as any[] }

  const { data: recentEvents } =
    recentEventIds.length > 0
      ? await supabase
          .from('events')
          .select('id, event_name, location, country')
          .in('id', recentEventIds)
      : { data: [] as any[] }

  const hikersMap = new Map((recentHikers ?? []).map((hiker) => [hiker.id, hiker]))
  const eventsMap = new Map((recentEvents ?? []).map((event) => [event.id, event]))

  return (
    <main className="min-h-screen bg-[#141312] text-stone-100">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="/mountain-hero.jpg"
            alt="Mountain hero background"
            className="h-full w-full object-cover object-[72%_18%] md:object-[72%_16%] xl:object-[72%_14%]"
          />
        </div>

        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,10,14,0.26)_0%,rgba(10,12,16,0.42)_28%,rgba(12,12,12,0.70)_62%,#141312_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_30%)]" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent to-[#141312]" />

        <div className="relative z-10 mx-auto max-w-7xl px-6 pt-10 pb-16 md:px-10 md:pt-14 md:pb-20">
          <header>
            <div className="mb-0 flex justify-center">
              <img
                src="/ultimate-logo-transparent-weiss.png"
                alt="Ultimate Hiking League"
                className="h-[230px] w-[230px] object-contain opacity-95 drop-shadow-[0_0_24px_rgba(255,255,255,0.08)]"
              />
            </div>

            <div className="mx-auto max-w-5xl text-center">
              <div className="mb-0 text-sm font-semibold uppercase tracking-[0.30em] text-stone-200 md:text-base">
                Ultimate European Hiking League
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-white md:text-5xl">
                Show us who you are.
              </h1>

              <p className="mx-auto mt-5 max-w-3xl text-lg font-medium text-stone-200">
                Europas Liga für echte Hiker!
              </p>
            </div>

            <div className="mx-auto mt-8 max-w-7xl">
              <Nav />
            </div>
          </header>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 pb-8 md:px-10">
        <section className="mb-12 rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.03] p-6 shadow-2xl shadow-black/20 backdrop-blur-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Top Rankings LIVE TEST</h2>
              <p className="mt-1 text-sm text-stone-400">
                Erste Sicht auf Europa und die drei Kern-Divisionen.
              </p>
            </div>

            <div className="hidden text-xs uppercase tracking-[0.2em] text-stone-500 md:block">
              Rankings
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-4">
            <RankingColumn
              title="Top 10 Europa"
              href="/"
              hikers={(globalData ?? []) as HikerRow[]}
            />
            <RankingColumn
              title="Top 10 Platinum"
              href="/division/platinum"
              hikers={(platinumData ?? []) as HikerRow[]}
              divisionStyle={getDivisionTitleClass('platinum')}
              divisionDotClass={getDivisionDotClass('platinum')}
            />
            <RankingColumn
              title="Top 10 Gold"
              href="/division/gold"
              hikers={(goldData ?? []) as HikerRow[]}
              divisionStyle={getDivisionTitleClass('gold')}
              divisionDotClass={getDivisionDotClass('gold')}
            />
            <RankingColumn
              title="Top 10 Silver"
              href="/division/silver"
              hikers={(silverData ?? []) as HikerRow[]}
              divisionStyle={getDivisionTitleClass('silver')}
              divisionDotClass={getDivisionDotClass('silver')}
            />
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/10 backdrop-blur-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">Neueste Aktivitäten</h3>
                <p className="mt-1 text-sm text-stone-400">
                  Frische Einträge aus der Liga.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {(recentRecords ?? []).map((record) => {
                const hiker = hikersMap.get(record.hiker_id)
                const event = eventsMap.get(record.event_id)

                return (
                  <div
                    key={record.id}
                    className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-black/10 px-4 py-4 transition-all duration-300 hover:border-white/15 hover:bg-white/[0.06] md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-base">
                          {countryToFlag(hiker?.country ?? null) || '—'}
                        </span>
                        <span className="truncate font-medium text-white">
                          {hiker?.display_name ?? 'Unbekannter Hiker'}
                        </span>
                      </div>

                      <div className="mt-1 text-sm text-stone-400">
                        {getEventDisplayName(event)}
                        {event?.location ? ` · ${event.location}` : ''}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {record.record_status && (
                          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-xs text-emerald-200">
                            {record.record_status}
                          </span>
                        )}

                        {record.is_corrected && (
                          <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-2 py-1 text-xs text-orange-200">
                            korrigiert
                          </span>
                        )}

                        <span
                          className={`rounded-full px-2 py-1 text-xs ${getDivisionBadgeClass(
                            record.division
                          )}`}
                        >
                          {record.division ?? '—'}
                        </span>
                      </div>
                    </div>

                    <div className="text-left md:text-right">
                      <div className="text-lg font-semibold text-white">
                        {record.distance_km ?? '—'} km
                      </div>
                      <div className="text-sm text-stone-400">
                        {record.activity_date
                          ? new Date(record.activity_date).toLocaleDateString('de-DE')
                          : '—'}
                      </div>
                    </div>
                  </div>
                )
              })}

              {(!recentRecords || recentRecords.length === 0) && (
                <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4 text-sm text-stone-400">
                  Noch keine aktuellen Aktivitäten vorhanden.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-gradient-to-b from-[#26231f] to-[#1c1a17] p-6 shadow-xl shadow-black/20 backdrop-blur-sm">
            <div className="mb-5">
              <h3 className="text-xl font-bold text-white">Nächste Events</h3>
              <p className="mt-1 text-sm text-stone-400">
                Die kommenden Highlights der Liga.
              </p>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4 transition hover:border-white/15 hover:bg-white/[0.05]">
                <div className="text-sm font-semibold text-white">
                  Megamarsch München
                </div>
                <div className="text-xs text-stone-400">
                  12. April · Deutschland
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4 transition hover:border-white/15 hover:bg-white/[0.05]">
                <div className="text-sm font-semibold text-white">
                  100km Berlin
                </div>
                <div className="text-xs text-stone-400">
                  03. Mai · Deutschland
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4 transition hover:border-white/15 hover:bg-white/[0.05]">
                <div className="text-sm font-semibold text-white">
                  Alpine Ultra Trail
                </div>
                <div className="text-xs text-stone-400">
                  21. Juni · Österreich
                </div>
              </div>
            </div>

            <div className="mt-6">
              <Link
                href="/events"
                className="inline-block rounded-2xl bg-stone-100 px-5 py-3 text-sm font-medium text-stone-950 transition hover:-translate-y-0.5 hover:bg-white"
              >
                Alle Events anzeigen
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}