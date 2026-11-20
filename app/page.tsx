import Link from 'next/link'
import Image from 'next/image'
import { supabase } from './lib/supabase'
import Nav from './components/Nav'
import { getPartnerAds } from './lib/partnerBookings'
import { BrandPlacement, HomePartnerPlacements } from './components/PartnerPlacements'
import ChristmasChallengeJoinButton from './components/ChristmasChallengeJoinButton'
import { CalendarDays, Trophy, CircleCheck } from 'lucide-react'

type HomeEventItem = {
  id: number
  slug: string
  title: string | null
  country: string | null
  event_date: string | null
  is_featured?: boolean | null
}

async function fetchUpcomingHomeEvents(): Promise<HomeEventItem[]> {
  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('events_master')
    .select('id, slug, title, country, event_date, is_featured')
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(5)

  if (error || !data) {
    return []
  }

  return data as HomeEventItem[]
}

export const dynamic = 'force-dynamic'

const CURRENT_YEAR = new Date().getFullYear()
const USE_SEASON_RANKING = new Date() >= new Date('2027-01-01T00:00:00')

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

function formatLeagueKm(value: number | null | undefined) {
  const safeValue = typeof value === 'number' && !Number.isNaN(value) ? value : 0
  return Math.round(safeValue).toLocaleString('de-DE')
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
        {hikers.slice(0, 10).map((hiker, index) => {
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
  const [{ data: christmasChallenge }, { data: siteStatsRow, error: siteStatsError }] = await Promise.all([
    supabase
    .from('challenges')
    .select(
      'id, slug, title, registration_start, registration_end, challenge_start, challenge_end, min_distance_km, status'
    )
    .eq('slug', 'christmas-challenge-2026')
    .single(),
    supabase
    .from('site_stats')
    .select('key, value_numeric')
    .eq('key', 'total_km')
    .single(),
  ])

    const { data: christmasParticipants } = christmasChallenge
      ? await supabase
          .from('challenge_participants')
          .select('hiker_id')
          .eq('challenge_id', christmasChallenge.id)
      : { data: [] }
    const christmasParticipantIds =
      christmasParticipants?.map((participant) => participant.hiker_id) ?? []

    const { data: christmasParticipantHikers } =
      christmasParticipantIds.length > 0
        ? await supabase
            .from('hikers')
            .select('id, display_name, country, profile_status')
            .in('id', christmasParticipantIds)
            .eq('profile_status', 'active')
        : { data: [] }

  const totalLeagueKm = siteStatsError
    ? 0
    : parseFloat(String(siteStatsRow?.value_numeric ?? '0'))

  const [{ data: globalData }, { data: platinumData }] = await Promise.all([
    supabase
    .from('hikers')
    .select('id, display_name, total_km, division, country')
    .eq('profile_status', 'active')
    .order('total_km', { ascending: false })
    .limit(10),
    supabase
    .from('hikers')
    .select('id, display_name, total_km, division, country')
    .eq('profile_status', 'active')
    .eq('division', 'platinum')
    .order('total_km', { ascending: false }),
  ])

  const [{ data: goldData }, { data: silverData }] = await Promise.all([
    supabase
    .from('hikers')
    .select('id, display_name, total_km, division, country')
    .eq('profile_status', 'active')
    .eq('division', 'gold')
    .order('total_km', { ascending: false }),
    supabase
    .from('hikers')
    .select('id, display_name, total_km, division, country')
    .eq('profile_status', 'active')
    .eq('division', 'silver')
    .order('total_km', { ascending: false }),
  ])

    let homepagePlatinumData = platinumData ?? []
    let homepageGoldData = goldData ?? []
    let homepageSilverData = silverData ?? []

    if (USE_SEASON_RANKING) {
      const { data: seasonStats } = await supabase
        .from('hiker_season_stats')
        .select('hiker_id, season_km')
        .eq('season_year', CURRENT_YEAR)

      const seasonKmByHiker = new Map(
        (seasonStats ?? []).map((row) => [
          row.hiker_id,
          typeof row.season_km === 'number' ? row.season_km : 0,
        ])
      )

      const applySeasonRanking = (hikers: HikerRow[]) =>
        hikers
          .map((hiker) => ({
            ...hiker,
            total_km: seasonKmByHiker.get(hiker.id) ?? 0,
          }))
          .sort((a, b) => (b.total_km ?? 0) - (a.total_km ?? 0))

      homepagePlatinumData = applySeasonRanking(platinumData ?? [])
      homepageGoldData = applySeasonRanking(goldData ?? [])
      homepageSilverData = applySeasonRanking(silverData ?? [])
    }

  const [homeEvents, partnerAds] = await Promise.all([
    fetchUpcomingHomeEvents(),
    getPartnerAds('home'),
  ])
  const middleAds = partnerAds.filter(ad => ad.booking_type === 'brand_partner' && ad.package_code === 'A')
  const topAds = partnerAds.filter(ad => ad.booking_type !== 'brand_partner' || ad.package_code !== 'A')

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

  const [{ data: recentHikers }, { data: recentEvents }] = await Promise.all([
    recentHikerIds.length > 0
      ? supabase
          .from('hikers')
          .select('id, display_name, country')
          .in('id', recentHikerIds)
      : { data: [] as { id: number; display_name: string; country: string | null }[] },
    recentEventIds.length > 0
      ? supabase
          .from('events')
          .select('id, event_name, location, country')
          .in('id', recentEventIds)
      : { data: [] as { id: number; event_name: string | null; location: string | null; country: string | null }[] },
  ])

  const hikersMap = new Map((recentHikers ?? []).map((hiker) => [hiker.id, hiker]))
  const eventsMap = new Map((recentEvents ?? []).map((event) => [event.id, event]))

  return (
    <main className="min-h-screen bg-[#141312] text-stone-100">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <picture>
            <source type="image/avif" srcSet="/images/home/mountain-hero.avif" />
            <source type="image/webp" srcSet="/images/home/mountain-hero.webp" />
            <img
              src="/mountain-hero.jpg"
              alt="Mountain hero background"
              width={1024}
              height={1536}
              loading="eager"
              fetchPriority="high"
              className="h-full w-full object-cover object-[72%_18%] md:object-[72%_16%] xl:object-[72%_14%]"
            />
          </picture>
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
              <Nav compactOnMobile={topAds.length > 0} />
              <HomePartnerPlacements ads={topAds} />
            </div>

            <div className="mt-7 flex justify-center">
              <Link
                href="/shop"
                aria-label="ULTIMATE Outdoor Shop öffnen"
                className="group inline-flex flex-col items-center rounded-full px-3 pb-3 outline-offset-4 transition-transform duration-300 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-cyan-300 motion-reduce:transform-none"
              >
                <Image
                  src="/shop/ultimate-outdoor-shop-icon.png"
                  alt="ULTIMATE Outdoor Shop: Ausrüstungskoffer mit Becher, Jacke und Trinkflasche vor einer Berglandschaft"
                  width={1287}
                  height={1222}
                  sizes="(min-width: 768px) 210px, 170px"
                  className="h-auto w-[170px] drop-shadow-[0_8px_24px_rgba(0,229,213,0.16)] transition-[filter] duration-300 group-hover:drop-shadow-[0_8px_32px_rgba(0,229,213,0.32)] md:w-[210px]"
                />
                <span className="mt-2 text-sm font-semibold tracking-wide text-cyan-200 transition-colors group-hover:text-white">Zum Outdoor Shop <span aria-hidden="true">→</span></span>
              </Link>
            </div>
          </header>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 pb-8 md:px-10">
                {christmasChallenge && christmasChallenge.status !== 'archived' ? (
                  <section
                    className="mb-8 overflow-hidden rounded-[2rem] border border-white/15 shadow-2xl shadow-black/30"
                    style={{
                      backgroundImage:
                        "linear-gradient(90deg, rgba(14,13,13,0.94) 0%, rgba(18,16,17,0.82) 48%, rgba(18,16,17,0.42) 100%), url('/images/home/christmas-challenge-2026-hero.webp')",
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    <div className="px-6 py-10 md:px-10 md:py-12">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-amber-200">
                        <span className="text-base">✦</span>
                        Christmas Special
                      </div>

                      <h2 className="mt-3 max-w-3xl text-3xl font-bold text-white md:text-4xl">
                        Christmas Challenge 2026
                      </h2>

                      <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-300 md:text-base">
                        Sammle vom 20. Oktober bis 15. Dezember so viele verifizierte Kilometer
                        wie möglich. Platz 1 gewinnt eine NEUE Garmin Venu Sq.
                      </p>

                      <div className="mt-5 grid max-w-[760px] gap-3 md:grid-cols-3">
                        <div className="flex min-h-[74px] items-center gap-3 rounded-2xl border border-white/40 bg-white/[0.04] px-4 py-3 backdrop-blur-sm">
                          <CalendarDays
                            size={17}
                            strokeWidth={1.8}
                            className="text-stone-300"
                          />
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                              Zeitraum
                            </div>
                            <div className="text-sm font-semibold text-white">
                              20. Okt. – 15. Dez.
                            </div>
                          </div>
                        </div>

                        <div className="flex min-h-[74px] items-center gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/[0.07] px-4 py-3 backdrop-blur-sm">
                          <Trophy
                            size={17}
                            strokeWidth={1.8}
                            className="text-amber-200"
                          />
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200/70">
                              Hauptpreis
                            </div>
                            <div className="text-sm font-semibold text-white">
                              Garmin Venu Sq
                            </div>
                          </div>
                        </div>

                        <div className="flex min-h-[74px] items-center gap-3 rounded-2xl border border-emerald-300/30 bg-emerald-300/[0.06] px-4 py-3 backdrop-blur-sm">
                          <CircleCheck
                            size={17}
                            strokeWidth={1.8}
                            className="text-emerald-200"
                          />
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200/70">
                              Teilnahme
                            </div>
                            <div className="text-sm font-semibold text-white">
                              Kostenlos · bis 19. Oktober
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-wrap items-center gap-3">
                        <ChristmasChallengeJoinButton
                          challengeId={christmasChallenge.id}
                          challengeStatus={christmasChallenge.status}
                        />

                        <Link
                          href={`/challenges/${christmasChallenge.slug}`}
                          className="inline-flex min-h-[50px] items-center rounded-2xl border border-white/15 bg-black/30 px-6 py-3 font-semibold text-white transition hover:border-white/25 hover:bg-white/10"
                        >
                          Challenge ansehen →
                        </Link>

                        <div className="ml-1 text-sm text-stone-400">
                          {christmasParticipantHikers?.length ?? 0}{' '}
                          {(christmasParticipantHikers?.length ?? 0) === 1
                            ? 'Teilnehmer'
                            : 'Teilnehmer'}
                        </div>
                      </div>
                    </div>
                  </section>
                ) : null}
               <section className="mb-8 rounded-[1.75rem] border border-white/8 bg-white/[0.03] px-6 py-5 shadow-lg shadow-black/10 backdrop-blur-sm">
                  <div className="text-center">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                      Liga-Stand
                    </div>

                    <p className="mt-2 text-base text-stone-300 md:text-lg">
                      Alles zählt. Und zusammen habt ihr schon {' '}
                      <span className="font-semibold text-white">
                        {formatLeagueKm(totalLeagueKm)} Kilometer
                      </span>{' '}
                      zurückgelegt.
                    </p>
                  </div>
                </section>

        {middleAds.length > 0 && <div className="mb-8"><BrandPlacement ads={middleAds} /></div>}
        <section className="mb-12 rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.03] p-6 shadow-2xl shadow-black/20 backdrop-blur-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Top Rankings</h2>
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
              href="/leaderboard/overall"
              hikers={(globalData ?? []) as HikerRow[]}
            />
            <RankingColumn
              title="Top 10 Platinum"
              href="/division/platinum"
              hikers={homepagePlatinumData as HikerRow[]}
              divisionStyle={getDivisionTitleClass('platinum')}
              divisionDotClass={getDivisionDotClass('platinum')}
            />
            <RankingColumn
              title="Top 10 Gold"
              href="/division/gold"
              hikers={homepageGoldData as HikerRow[]}
              divisionStyle={getDivisionTitleClass('gold')}
              divisionDotClass={getDivisionDotClass('gold')}
            />
            <RankingColumn
              title="Top 10 Silver"
              href="/division/silver"
              hikers={homepageSilverData as HikerRow[]}
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
              {homeEvents.length > 0 ? (
                homeEvents.map((event) => (
                  <Link
                    key={event.id}
                    href={`/events/${event.slug}`}
                    className={`block rounded-2xl px-4 py-4 transition ${
                      event.is_featured
                        ? 'border border-amber-400/25 bg-amber-400/10 hover:border-amber-300/40 hover:bg-amber-400/15'
                        : 'border border-white/8 bg-black/10 hover:border-white/15 hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-white">
                        {event.title ?? 'Unbenanntes Event'}
                      </div>

                      {event.is_featured && (
                        <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200">
                          Featured
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-stone-400">
                      {event.event_date
                        ? new Date(event.event_date).toLocaleDateString('de-DE', {
                            day: '2-digit',
                            month: 'long',
                          })
                        : 'Datum offen'}
                      {event.country ? ` · ${event.country}` : ''}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4 text-sm text-stone-400">
                  Aktuell sind keine kommenden Events hinterlegt.
                </div>
              )}
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
