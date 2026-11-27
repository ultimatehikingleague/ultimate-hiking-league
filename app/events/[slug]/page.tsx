import { eventReviewSummaries, reviewCursor, type PublicReview, type ReviewQuery } from '../../lib/event-reviews'
import ReviewPanel, { ReviewOverviewLink } from '../../components/reviews/ReviewPanel'
import { ReviewBadge } from '../../components/reviews/ReviewDisplay'
import { reviewCopy } from '../../lib/review-copy'
import { getLocale, getTranslations } from 'next-intl/server'
import { EventSponsors } from '../../components/PartnerPlacements'
import { eventAdIndex, getPartnerAds } from '../../lib/partnerBookings'
import { garminAttribution, type GarminRecordAttribution } from '../../lib/activity/garmin-attribution'
import Link from '@/i18n/prototype/LocalizedLink'
import { formatDistanceKm } from '../../lib/activity/display'
import { supabase } from '../../lib/supabase'

export const dynamic = 'force-dynamic'

type EventDistance = {
  id: number
  distance_km: number
  label: string | null
}

type EventDetail = {
  id: number
  slug: string
  title: string
  city: string | null
  country: string | null
  country_code: string | null
  event_date: string | null
  brand: string | null
  description: string | null
  official_url: string | null
  event_distances: EventDistance[]
}

type RecordRow = {
  id: number
  hiker_id: number | null
  event_distance_id: number | null
  time_text: string | null
  time_hours: number | null
  verified: boolean | null
  record_status: string | null
  garmin_verified: boolean | null
  garmin_record_attributions: GarminRecordAttribution
}

type HikerRow = {
  id: number
  display_name: string | null
  country: string | null
}

function countryToFlag(countryCode?: string | null) {
  if (!countryCode) return ''
  const code = countryCode.trim().toUpperCase()
  if (code.length !== 2) return ''
  return String.fromCodePoint(
    ...[...code].map((char) => 127397 + char.charCodeAt(0))
  )
}

function formatDate(dateString: string, locale: string) {
  return new Date(dateString).toLocaleDateString(locale === 'de' ? 'de-DE' : locale === 'en' ? 'en-GB' : locale)
}

function getHikerName(hikerId: number | null, hikersMap: Map<number, HikerRow>) {
  if (hikerId === null) return 'Unbekannter Hiker'
  return hikersMap.get(hikerId)?.display_name || `Hiker ${hikerId}`
}

function getHikerCountry(hikerId: number | null, hikersMap: Map<number, HikerRow>) {
  if (hikerId === null) return null
  return hikersMap.get(hikerId)?.country || null
}



async function getEventBySlug(slug: string): Promise<EventDetail | null> {
  const { data, error } = await supabase
    .from('events_master')
    .select(
      'id,slug,title,city,country,country_code,event_date,brand,description,official_url,event_distances(id,distance_km,label)'
    )
    .eq('slug', slug)
    .limit(1)

  if (error) {
    throw new Error(error.message)
  }

  return (data?.[0] as EventDetail) ?? null
}

async function getEventRecords(eventMasterId: number): Promise<RecordRow[]> {
  const { data, error } = await supabase
    .from('records')
    .select('id,hiker_id,event_distance_id,time_text,time_hours,verified,record_status,garmin_verified,garmin_record_attributions(device_model)')
    .eq('event_master_id', eventMasterId)
    .order('time_hours', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data as RecordRow[]) ?? []
}

async function getHikersMap(hikerIds: number[]): Promise<Map<number, HikerRow>> {
  if (hikerIds.length === 0) {
    return new Map()
  }

  const uniqueIds = Array.from(new Set(hikerIds))

  const { data, error } = await supabase
    .from('hikers')
    .select('id,display_name,country')
    .in('id', uniqueIds)

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data as HikerRow[]) ?? []
  return new Map(rows.map((row) => [row.id, row]))
}

export default async function EventDetailPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams?: Promise<ReviewQuery>
}) {
  const [t, locale, ui] = await Promise.all([getTranslations('eventDetail'), getLocale(), getTranslations('ui')])
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const cursor = reviewCursor(query?.before)
  const event = await getEventBySlug(slug)

  if (!event) {
    return (
      <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap gap-4">
            <Link
              href="/"
              className="text-sm text-stone-400 transition hover:text-white"
            >
              {t('backHome')}
            </Link>

            <Link
              href="/leaderboard"
              className="text-sm text-stone-400 transition hover:text-white"
            >
              {t('backRankings')}
            </Link>

            <Link
              href="/events"
              className="text-sm text-stone-400 transition hover:text-white"
            >
              {t('backEvents')}
            </Link>
          </div>

          <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8">
            <h1 className="text-3xl font-bold text-white">{t('notFound')}</h1>
            <p className="mt-3 text-stone-400">
              {t('notFoundDescription')}
            </p>
          </div>
        </div>
      </main>
    )
  }

  const [records, partnerAds] = await Promise.all([getEventRecords(event.id), getPartnerAds('events')])
  const eventAds = eventAdIndex(partnerAds).get(event.id)
  const hikerIds = records
    .map((record) => record.hiker_id)
    .filter((id): id is number => typeof id === 'number')

  const hikersMap = await getHikersMap(hikerIds)

  const reviewSummary = (await eventReviewSummaries([event.id])).get(event.id)
  const reviewRows = reviewSummary ? await supabase.rpc('uhl_public_reviews', {
    p_event: event.id, p_organizer: null, p_before: cursor,
  }) : null

  const groupedByDistance = (event.event_distances ?? [])
    .slice()
    .sort((a, b) => a.distance_km - b.distance_km)
    .map((distance) => {
      const entries = records.filter(
        (record) => record.event_distance_id === distance.id
      )

      const timed = entries
        .filter(
          (record) =>
            record.verified === true &&
            record.time_hours !== null &&
            !!record.time_text
        )
        .sort((a, b) => {
          const aValue = a.time_hours ?? Number.MAX_SAFE_INTEGER
          const bValue = b.time_hours ?? Number.MAX_SAFE_INTEGER
          return aValue - bValue
        })

      const finishers = entries
        .filter(
          (record) =>
            !(
              record.verified === true &&
              record.time_hours !== null &&
              !!record.time_text
            )
        )
        .sort((a, b) => {
          const nameA = getHikerName(a.hiker_id, hikersMap)
          const nameB = getHikerName(b.hiker_id, hikersMap)
          return nameA.localeCompare(nameB, 'de')
        })

      return {
        distance: distance.label || `${formatDistanceKm(distance.distance_km) ?? '—'} km`,
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

        <div className="relative z-10 mx-auto max-w-6xl px-6 pb-16 pt-12 md:px-10 md:pb-24 md:pt-16">
          
          <div className="flex flex-wrap gap-4">
            <Link
              href="/"
              className="inline-block rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-stone-200 transition hover:border-white/20 hover:bg-white/10"
            >
              {t('backHome')}
            </Link>

            <Link
              href="/leaderboard"
              className="inline-block rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-stone-200 transition hover:border-white/20 hover:bg-white/10"
            >
              {t('backRankings')}
            </Link>

            <Link
              href="/events"
              className="inline-block rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-stone-200 transition hover:border-white/20 hover:bg-white/10"
            >
              {t('backEvents')}
            </Link>
          </div>

          <div className="mt-10 max-w-4xl">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="text-2xl">{countryToFlag(event.country_code)}</span>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs uppercase tracking-[0.18em] text-stone-300">
                {event.brand ?? 'Event'}
              </span>
            </div>

            <div className="flex flex-col items-start gap-4 lg:flex-row lg:items-center">
              <h1 className="min-w-0 text-4xl font-bold tracking-tight text-white md:text-6xl">{event.title}</h1>
              {reviewSummary && <ReviewOverviewLink>
                {reviewSummary.review_count ? <ReviewBadge {...reviewSummary} locale={locale} stacked /> : reviewCopy(locale).reviews}
              </ReviewOverviewLink>}
            </div>

            
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 pb-12 md:px-10">
        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/10 backdrop-blur-sm">
            <div className="mb-5">
              <h2 className="text-2xl font-bold text-white">{t('details')}</h2>
              <p className="mt-1 text-sm text-stone-400">
                {t('overview')}
              </p>
            </div>

            {eventAds && <div className="mb-5"><EventSponsors ads={eventAds} detail /></div>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  {t('city')}
                </div>
                <div className="mt-2 font-semibold text-white">
                  {event.city ?? t('notDecided')}
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  {t('country')}
                </div>
                <div className="mt-2 font-semibold text-white">
                  {event.country ?? t('toBeAnnounced')}
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  {t('date')}
                </div>
                <div className="mt-2 font-semibold text-white">
                  {event.event_date ? formatDate(event.event_date, locale) : t('toBeAnnounced')}
                </div>
              </div>

             {event.description ? (
               <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4 sm:col-span-2">
                 <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                   {t('description')}
                 </div>
                 <div className="mt-2 text-sm text-stone-200">
                   {event.description}
                 </div>
               </div>
             ) : null}

             {event.official_url ? (
               <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4 sm:col-span-2">
                 <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                   {t('officialPage')}
                 </div>
                 <a
                   href={event.official_url}
                   target="_blank"
                   rel="noreferrer"
                   className="mt-3 inline-block rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-stone-200"
                 >
                   {t('registrationPage')}
                 </a>
               </div>
             ) : null}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-gradient-to-b from-[#26231f] to-[#1c1a17] p-6 shadow-xl shadow-black/20 backdrop-blur-sm">
            <div className="mb-5">
              <h2 className="text-2xl font-bold text-white">{t('distances')}</h2>
              <p className="mt-1 text-sm text-stone-400">
                {t('rankedRoutes')}
              </p>
            </div>

            <div className="space-y-3">
              {groupedByDistance.map((group) => (
                <div
                  key={group.distance}
                  className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4 transition hover:border-white/15 hover:bg-white/[0.05]"
                >
                  <div className="text-lg font-semibold text-white">
                    {group.distance}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <Link
                href="/events"
                className="inline-block rounded-2xl bg-stone-100 px-5 py-3 text-sm font-medium text-stone-950 transition hover:-translate-y-0.5 hover:bg-white"
              >
                {t('backOverview')}
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/10 backdrop-blur-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">{t('ranking')}</h2>
              <p className="mt-1 text-sm text-stone-400">
                {t('verifiedTimes')}
              </p>
            </div>

            <div className="hidden text-xs uppercase tracking-[0.2em] text-stone-500 md:block">
              {t('rankings')}
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
                      {ui('eventRankingLabel')}
                    </div>

                    {group.timed.length > 0 ? (
                      <div className="space-y-3">
                        {group.timed.slice(0, 10).map((entry, index) => (
                          <div
                            key={`timed-${entry.id}`}
                            className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-4 transition-all duration-300 hover:border-white/15 hover:bg-white/[0.06] md:flex-row md:items-center md:justify-between"
                          >
                            <div className="flex min-w-0 items-center gap-4">
                              <div className="w-8 text-lg font-semibold text-white">
                                {index + 1}.
                              </div>

                              <div className="text-lg">
                                {countryToFlag(getHikerCountry(entry.hiker_id, hikersMap))}
                              </div>

                             <div className="min-w-0">
                               {entry.hiker_id ? (
                                 <Link
                                   href={`/${entry.hiker_id}`}
                                   className="truncate font-semibold text-white transition hover:text-stone-300"
                                 >
                                   {entry.hiker_id === null ? t('unknownHiker') : getHikerName(entry.hiker_id, hikersMap)}
                                 </Link>
                               ) : (
                                 <div className="truncate font-semibold text-white">
                                   {entry.hiker_id === null ? t('unknownHiker') : getHikerName(entry.hiker_id, hikersMap)}
                                 </div>
                               )}
                               {entry.garmin_verified && (
                                 <div className="mt-1 text-sm text-stone-300">{garminAttribution(entry)}</div>
                               )}
                             </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 md:justify-end">
                              <div className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-sm text-stone-200">
                                {t('timeLabel')} {entry.time_text}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-4 text-sm text-stone-400">
                        {t('noTimes')}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">
                      {t('otherFinishers')}
                    </div>

                    {group.finishers.length > 0 ? (
                      <div className="space-y-3">
                        {group.finishers.slice(0, 10).map((entry) => (
                          <div
                            key={`finisher-${entry.id}`}
                            className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-4 transition-all duration-300 hover:border-white/15 hover:bg-white/[0.06] md:flex-row md:items-center md:justify-between"
                          >
                            <div className="flex min-w-0 items-center gap-4">
                              <div className="text-lg">
                                {countryToFlag(getHikerCountry(entry.hiker_id, hikersMap))}
                              </div>

                              <div className="min-w-0">
                                <div className="truncate font-semibold text-white">
                                  {entry.hiker_id === null ? t('unknownHiker') : getHikerName(entry.hiker_id, hikersMap)}
                                </div>
                              </div>
                            </div>

                            <div className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-xs text-stone-300">
                              {t('finishers')}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-4 text-sm text-stone-400">
                        {t('noOtherFinishers')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        {reviewSummary && <ReviewPanel key={event.id} event={event.id} locale={locale} summary={reviewSummary}
          pagePath={`/events/${encodeURIComponent(slug)}`} paginated={Boolean(cursor)} initialRows={reviewRows?.data as PublicReview[] | null ?? []} loadError={Boolean(reviewRows?.error)} />}
      </div>
    </main>
  )
}