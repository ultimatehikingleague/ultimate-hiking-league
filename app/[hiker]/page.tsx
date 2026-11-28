import ProfileEventReviewLink from '../components/reviews/ProfileEventReviewLink'
import { eventReviewSummaries } from '../lib/event-reviews'
import { getLocale, getTranslations } from 'next-intl/server'
import { BrandPlacement } from '../components/PartnerPlacements'
import { getPartnerAds } from '../lib/partnerBookings'
import { garminAttribution } from '../lib/activity/garmin-attribution'
import Link from '@/i18n/prototype/LocalizedLink'
import { formatDistanceKm, formatElevationMeters, formatElapsedTime } from '../lib/activity/display'
import { supabase } from '../lib/supabase'
import CorrectionRequestForm from '../components/CorrectionRequestForm'
import { formatRankingDistance } from '@/i18n/display'
import { getSeasonYear, SEASON_RANKINGS_START } from '../lib/season'
import { fetchProfileRanking } from '../lib/rankings'
import SeasonRefresh from '../components/SeasonRefresh'
import ProfileBrandBar from '../components/ProfileBrandBar'
import ClaimProfilePanel from '../components/ClaimProfilePanel'
import { countryToFlag } from '../lib/country'


function getDivisionBadgeClass(division: string | null) {
  switch (division) {
    case 'platinum':
      return 'border border-fuchsia-400/30 bg-fuchsia-400/12 text-fuchsia-200'
    case 'gold':
      return 'border border-yellow-400/30 bg-yellow-400/12 text-yellow-200'
    case 'silver':
      return 'border border-stone-300/25 bg-stone-300/10 text-stone-100'
    default:
      return 'border border-stone-300/20 bg-stone-300/5 text-stone-400'
  }
}

function getRecordStatusClass(status: string | null) {
  if (!status) {
    return 'border border-stone-300/20 bg-stone-300/5 text-stone-400'
  }

  if (status.toLowerCase().includes('verified')) {
    return 'border border-emerald-400/30 bg-emerald-400/12 text-emerald-200'
  }

  return 'border border-stone-300/20 bg-stone-300/5 text-stone-300'
}

function formatSpeed(speed: number | null) {
  if (speed === null || speed === undefined) return '—'
  return `${speed} km/h`
}

function formatDate(dateText: string | null) {
  if (!dateText) return '—'
  const date = new Date(dateText)
  return date.toLocaleDateString('de-DE')
}


function getEventDisplayName(
  event: any,
  record: {
    custom_title?: string | null
  },
  fallback: string
) {
  if (event?.title && event.title.trim() !== '') {
    return event.title
  }

  if (record?.custom_title && record.custom_title.trim() !== '') {
    return record.custom_title
  }

  return fallback
}

export const dynamic = 'force-dynamic'

export default async function HikerPage({
  params,
}: {
  params: Promise<{ hiker: string }>
}) {
  const year = getSeasonYear()
  const useSeason = year >= SEASON_RANKINGS_START
  const [t, ui, locale] = await Promise.all([getTranslations('publicProfile'), getTranslations('ui'), getLocale()])
  const { hiker } = await params

  const hikerId = Number(hiker)

  if (!Number.isInteger(hikerId) || hikerId <= 0) {
    return (
      <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
        <div className="mx-auto max-w-5xl">
          <ProfileBrandBar />

          <Link
            href="/leaderboard/overall"
            className="mb-6 inline-block text-sm text-stone-400 transition hover:text-white"
          >
            {t('back')}
          </Link>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-xl shadow-black/10">
            <p className="text-stone-300">{t('notFound')}</p>
          </div>
        </div>
      </main>
    )
  }

  const { data: hikerData, error: hikerError } = await supabase
    .from('hikers')
    .select(
      'id, display_name, total_km, division, country, avg_speed, profile_image, claimed_profile, claimed_by_user_id, profile_status, hide_private_records'
    )
    .eq('id', hikerId)
    .single()
  
   const {
      data: { session },
    } = await supabase.auth.getSession()

    const isOwnProfile =
      !!session?.user?.id &&
      hikerData?.claimed_by_user_id === session.user.id

    const isPubliclyVisible = hikerData?.profile_status === 'active'

    if (hikerData && !isPubliclyVisible && !isOwnProfile) {
      return (
        <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
          <div className="mx-auto max-w-5xl">
            <ProfileBrandBar />

            <Link
              href="/leaderboard/overall"
              className="mb-6 inline-block text-sm text-stone-400 transition hover:text-white"
            >
              {t('back')}
            </Link>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-xl shadow-black/10">
              <p className="text-stone-300">{t('notFound')}</p>
            </div>
          </div>
        </main>
      )
    } 

  if (hikerError || !hikerData) {
    return (
      <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
        <div className="mx-auto max-w-5xl">
          <ProfileBrandBar />

          <Link
            href="/leaderboard/overall"
            className="mb-6 inline-block text-sm text-stone-400 transition hover:text-white"
          >
            {t('back')}
          </Link>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-xl shadow-black/10">
            <p className="text-stone-300">{t('notFound')}</p>
          </div>
        </div>
      </main>
    )
  }

  const [seasonStats, ranks] = await Promise.all([
    supabase.from('hiker_season_stats')
      .select('season_km')
      .eq('hiker_id', hikerData.id)
      .eq('season_year', year)
      .maybeSingle(),
    fetchProfileRanking(hikerData.id, year),
  ])
  const seasonKm = Number(seasonStats.data?.season_km ?? 0)

  const { data: recordsData, error: recordsError } = await supabase
  .from('records')
  .select(
    `
        id,
        distance_km,
        time_hours,
        avg_speed,
        division,
        time_text,
        activity_date,
        record_status,
        garmin_verified,
        garmin_record_attributions(device_model),
        event_master_id,
        is_public,
        is_corrected,
        elevation_gain,
        custom_title,
        custom_description,
        custom_location,
        custom_country
      `
  )
  .eq('hiker_id', hikerId)
  .order('activity_date', { ascending: false })

  const visibleRecords =
    recordsData?.filter((record) => {
      if (isOwnProfile) return true

      if (record.event_master_id) return true

      if (hikerData.hide_private_records) return false

      return record.is_public !== false
    }) ?? []

  const eventIds =
    [...new Set((recordsData ?? []).map((record) => record.event_master_id).filter((id): id is number => typeof id === 'number'))]
  const visibleEventIds =
    [...new Set(visibleRecords.map((record) => record.event_master_id).filter((id): id is number => typeof id === 'number'))]

  const [{ data: eventsData }, reviewSummaries] = await Promise.all([
    eventIds.length > 0
      ? supabase
          .from('events_master')
          .select(
            'id, slug, title, event_date, city, country, brand'
          )
          .in('id', eventIds)
      : { data: [] },
    eventReviewSummaries(visibleEventIds),
  ])

  const eventsMap = new Map((eventsData ?? []).map((event) => [event.id, event]))

  const totalElevation =
    recordsData?.reduce((sum, record) => {
      return sum + (typeof record.elevation_gain === 'number' ? record.elevation_gain : 0)
    }, 0) ?? 0

  const eventRecords =
  recordsData?.filter((record) => record.event_master_id) ?? []

const totalEventDistance = eventRecords.reduce(
  (sum, record) =>
    sum + (typeof record.distance_km === 'number' ? record.distance_km : 0),
  0
)

const totalEventHours = eventRecords.reduce(
  (sum, record) =>
    sum + (typeof record.time_hours === 'number' ? record.time_hours : 0),
  0
)

const eventAvgSpeed =
  totalEventHours > 0
    ? totalEventDistance / totalEventHours
    : null

const totalDistance =
  recordsData?.reduce(
    (sum, record) =>
      sum + (typeof record.distance_km === 'number' ? record.distance_km : 0),
    0
  ) ?? 0

const elevationPerKm =
  totalDistance > 0
    ? totalElevation / totalDistance
    : null  

  const partnerAds = await getPartnerAds('profile')

  return (
    <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
      <SeasonRefresh year={year} />
      <div className="mx-auto max-w-5xl">
        <ProfileBrandBar />

        <Link
          href="/leaderboard/overall"
          className="mb-6 inline-block text-sm text-stone-400 transition hover:text-white"
        >
          {t('back')}
        </Link>

        {isOwnProfile && hikerData.profile_status !== 'active' ? (
          <div className="mb-6 rounded-[2rem] border border-yellow-400/25 bg-yellow-400/10 p-5 text-yellow-100">
            <div className="text-lg font-semibold">
              {t('paused')}
            </div>
            <p className="mt-2 text-sm leading-6 text-yellow-100/80">
              {t('pausedDetails')}
            </p>
          </div>
        ) : null}

        <section className="mb-8 rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.03] p-6 shadow-2xl shadow-black/20 backdrop-blur-sm md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <div className="flex h-28 w-28 items-center justify-center rounded-[2rem] border border-white/10 bg-black/15 text-4xl shadow-xl shadow-black/10">
              {hikerData.profile_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={hikerData.profile_image}
                  alt={hikerData.display_name ?? 'Hiker'}
                  className="h-28 w-28 rounded-[2rem] object-cover"
                />
              ) : (
                '🥾'
              )}
            </div>

            <div className="flex-1">
              <div className="mb-3">
                <div className="text-sm font-semibold uppercase tracking-[0.24em] text-stone-400">
                  {t('profile')}
                </div>

                <h1 className="mt-2 text-4xl font-bold tracking-tight text-white md:text-5xl">
                  {hikerData.display_name ?? t('unknown')}
                </h1>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/15 px-3 py-1.5 text-sm text-stone-200">
                  <span className="text-base">
                    {countryToFlag(hikerData.country)}
                  </span>
                  <span>{hikerData.country ?? '—'}</span>
                </div>

                <div
                  className={`inline-flex rounded-full px-3 py-1.5 text-sm ${getDivisionBadgeClass(
                    hikerData.division
                  )}`}
                >
                  {hikerData.division ?? t('unranked')}
                </div>

                {hikerData.claimed_profile ? (
                  <div className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/12 px-3 py-1.5 text-sm text-emerald-200">
                    {t('verifiedBadge')}
                  </div>
                ) : null}

                {ranks.skyscraper ? (
                  <div className="inline-flex rounded-full border border-sky-400/30 bg-sky-400/12 px-3 py-1.5 text-sm text-sky-200">
                    {t('skyscraperAchieved')}
                  </div>
                ) : null}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                    {ui('seasonDistance', { year })}
                  </div>
                  <div className="mt-1 text-2xl font-bold text-white">
                    {seasonStats.error ? ui('rankingUnavailable') : `${formatRankingDistance(seasonKm, locale)} km`}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                    {ui('allTimeDistance')}
                  </div>
                  <div className="mt-1 text-2xl font-bold text-white">
                    {formatRankingDistance(hikerData.total_km ?? 0, locale)} km
                  </div>
                </div>

              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                    {useSeason ? ui('seasonRank', { year }) : ui('allTimeRank')}
                  </div>
                  <div className="mt-1 text-2xl font-bold text-white">
                    {ranks.overall ? `#${ranks.overall}` : '—'}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                    {useSeason ? ui('divisionSeasonRank', { year }) : t('divisionRank')}
                  </div>
                  <div className="mt-1 text-2xl font-bold text-white">
                    {ranks.division ? `#${ranks.division}` : '—'}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                    {t('averageSpeed')}
                  </div>
                  <div className="mt-1 text-2xl font-bold text-white">
                    {formatSpeed(hikerData.avg_speed)}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                    {t('averageEventSpeed')}
                  </div>
                  <div className="mt-1 text-2xl font-bold text-white">
                    {eventAvgSpeed !== null
                      ? `${eventAvgSpeed.toFixed(2)} km/h`
                      : '-'}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                    {t('elevation')}
                  </div>
                  <div className="mt-1 text-2xl font-bold text-white">
                    {Math.round(totalElevation).toLocaleString('de-DE')} hm
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                    {t('elevationPerKm')}
                  </div>
                  <div className="mt-1 text-2xl font-bold text-white">
                    {elevationPerKm !== null
                      ? `${elevationPerKm.toFixed(1)} hm/km`
                      : '-'}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                    Skyscraper
                  </div>
                  <div className="mt-1 text-2xl font-bold text-white">
                    {ranks.skyscraper ? `#${ranks.skyscraper}` : ranks.skyscraperUnavailable ? ui('rankingUnavailable') : t('pending')}
                  </div>
                </div>
              </div>
            </div>

            <div>
              {!hikerData.claimed_profile ? (
                <ClaimProfilePanel
                  hikerId={hikerData.id}
                  profileName={hikerData.display_name}
                />
              ) : (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-3 text-sm font-medium text-emerald-200">
                  <div>{t('verified')}</div>
                  <div className="text-xs text-emerald-300/80">
                    {t('claimed')}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {partnerAds.length > 0 && <div className="mb-8"><BrandPlacement ads={partnerAds} label={t('adLabel')} /></div>}

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">{t('performance')}</h2>
            <div className="text-sm text-stone-400">
              {recordsData?.length ?? 0} {t('entries')}
            </div>
          </div>

          {recordsError && (
            <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
              {t('error')}
            </div>
          )}

          {!recordsData || recordsData.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-stone-400">
              {t('noEntries')}
            </div>
          ) : (
            <div className="space-y-3">
              {visibleRecords.map((record) => {
                const event = eventsMap.get(record.event_master_id)
                const review = reviewSummaries.get(record.event_master_id)

                return (
                  <div
                    key={record.id}
                    className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/10"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 text-sm text-stone-500">
                          {formatDate(event?.event_date ?? record.activity_date)}
                        </div>

                        <div className="text-lg font-semibold text-white">
                          {getEventDisplayName(event, record, ui('privateEntry'))}
                        </div>

                        {record.garmin_verified && (
                          <div className="mt-1 text-sm text-stone-300">{garminAttribution(record)}</div>
                        )}

                        <div className="mt-1 text-sm text-stone-400">
                          {event ? (
                            <>
                              <span className="inline-flex items-center gap-1">
                                {countryToFlag(event?.country) && (
                                  <span className="text-base">
                                    {countryToFlag(event?.country)}
                                  </span>
                                )}
                                <span>{event?.country ?? '—'}</span>
                              </span>{' '}
                              · {event?.city ?? '—'} · {event?.brand ?? '—'}
                            </>
                          ) : (
                            <>
                              <span className="inline-flex items-center gap-1">
                                {countryToFlag(record.custom_country ?? null) && (
                                  <span className="text-base">
                                    {countryToFlag(record.custom_country ?? null)}
                                  </span>
                                )}
                                <span>{record.custom_country ?? '—'}</span>
                              </span>{' '}
                              · {record.custom_location ?? '—'}
                            </>
                          )}
                        </div>

                        {event?.slug && review && <ProfileEventReviewLink
                          summary={{ score: review.score, review_count: review.review_count }} slug={event.slug} recordId={record.id} locale={locale} />}
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          

                          {record.record_status && (
                            <span
                              className={`rounded-full px-2 py-1 ${getRecordStatusClass(
                                record.record_status
                              )}`}
                            >
                              {record.garmin_verified && record.record_status === 'verified_admin_submission'
                                ? t('recordVerified')
                                : record.record_status}
                            </span>
                          )}

                          {record.is_corrected && (
                            <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-2 py-1 text-orange-200">
                              {t('corrected')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid min-w-[220px] grid-cols-2 gap-3 md:w-[420px]">
                        <div className="rounded-2xl border border-white/8 bg-black/10 p-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                            {t('distance')}
                          </div>
                          <div className="font-semibold text-white">
                            {formatDistanceKm(record.distance_km) ?? '—'} km
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/8 bg-black/10 p-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                            {t('time')}
                          </div>
                          <div className="font-semibold text-white">
                            {formatElapsedTime(record.time_text, record.time_hours) ?? '—'}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/8 bg-black/10 p-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                            {t('speed')}
                          </div>
                          <div className="font-semibold text-white">
                            {formatSpeed(record.avg_speed)}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/8 bg-black/10 p-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                            {t('dailyForm')}
                          </div>
                          <div>
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium ${getDivisionBadgeClass(
                                record.division
                              )}`}
                            >
                              {record.division ?? '—'}
                            </span>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/8 bg-black/10 p-3 col-span-2">
                          <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                            {t('elevation')}
                          </div>
                          <div className="font-semibold text-white">
                            {typeof record.elevation_gain === 'number'
                              ? `${formatElevationMeters(record.elevation_gain)} hm`
                              : '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                    

                   {record.custom_description && (
                     <p className="mt-3 whitespace-pre-wrap break-words text-sm text-stone-300">{record.custom_description}</p>
                   )}
                   <CorrectionRequestForm
                      recordId={record.id}
                      hikerId={hikerData.id}
                      isOfficialEvent={!!record.event_master_id}
                      initialActivityName={
                        event?.title ??
                        record.custom_title ??
                        ''
                      }
                      initialActivityDate={
                        event?.event_date ??
                        record.activity_date ??
                        ''
                      }
                      initialOfficialDistanceKm={record.distance_km}
                      initialActualDistanceKm={record.distance_km}
                      initialElapsedTimeText={record.time_text}
                      initialElevationGain={record.elevation_gain}
                      initialCountry={
                        event?.country ??
                        record.custom_country ??
                        ''
                      }
                      initialLocation={
                        event?.city ??
                        record.custom_location ??
                        ''
                      }
                      initialRecordSource={
                        event?.brand ??
                        ''
                      }
                    /> 
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}