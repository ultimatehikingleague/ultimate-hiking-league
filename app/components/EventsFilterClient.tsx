'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import Link from '@/i18n/prototype/LocalizedLink'
import { CalendarDays } from 'lucide-react'
import { EventSponsors } from './PartnerPlacements'
import { eventAdIndex, type PartnerAd } from '../lib/partnerBookings'
import { supabase } from '../lib/supabase'

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

type CountryOption = {
  code: string
  label: string
  count: number
}

type MonthGroup = {
  key: string
  label: string
  events: EventItem[]
}

function countryToFlag(countryCode: string | null) {
  if (!countryCode) return ''
  const code = countryCode.trim().toUpperCase()
  if (code.length !== 2) return ''
  return String.fromCodePoint(
    ...[...code].map((char) => 127397 + char.charCodeAt(0))
  )
}

function countryNameFromCode(countryCode: string | null, locale = 'de') {
  if (!countryCode) return 'Unbekannt'
  const code = countryCode.trim().toUpperCase()

  const names = new Intl.DisplayNames([locale], { type: 'region' })
  return names.of(code) ?? code
}

function parseGermanDate(dateString: string) {
  const [day, month, year] = dateString.split('.')
  const parsedDay = Number(day)
  const parsedMonth = Number(month)
  const parsedYear = Number(year)

  if (!parsedDay || !parsedMonth || !parsedYear) {
    return null
  }

  return new Date(parsedYear, parsedMonth - 1, parsedDay)
}

function getMonthKey(dateString: string) {
  const date = parseGermanDate(dateString)
  if (!date) return 'unknown'

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function getMonthLabel(dateString: string, locale: string, missing: string) {
  const date = parseGermanDate(dateString)
  if (!date) return missing

  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function EventCard({
  event,
  userId,
  isSaved,
  calendarLoading,
  onAddToCalendar,
  ads,
}: {
  event: EventItem
  userId: string | null
  isSaved: boolean
  calendarLoading: boolean
  onAddToCalendar: (eventId: number) => Promise<void>
  ads?: PartnerAd[]
}) {
  const t = useTranslations('eventCalendar')
  const locale = useLocale()
  return (
    <div className={'rounded-3xl border p-5 shadow-xl shadow-black/10 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-white/20 ' +
      (ads?.[0]?.package_code === 'D' ? 'border-amber-200/50 bg-[#372e1d]' : ads ? 'border-emerald-200/35 bg-[#213125]' : 'border-white/10 bg-white/[0.05] hover:bg-white/[0.08]')}>
      {ads && <div className="mb-4"><EventSponsors ads={ads} /></div>}
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
            {t('date')}
          </div>
          <div className="mt-1 font-semibold text-white">{locale === 'de' ? event.date : parseGermanDate(event.date)?.toLocaleDateString(locale === 'en' ? 'en-GB' : locale) ?? event.date}</div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
          <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
            {t('distances')}
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

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={`/events/${event.slug}`}
          className="inline-flex items-center rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-stone-100 transition hover:bg-white/10"
        >
          {t('openEvent')}
        </Link>

        {userId ? (
          <button
            type="button"
            onClick={() => onAddToCalendar(event.id)}
            disabled={calendarLoading || isSaved}
            className={`inline-flex items-center rounded-2xl border px-4 py-2 text-sm font-medium transition ${
              isSaved
                ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                : 'border-white/15 bg-white/5 text-stone-100 hover:bg-white/10'
            } disabled:cursor-default`}
          >
            {calendarLoading
              ? t('loadingCalendar')
              : isSaved
                ? t('saved')
                : t('addToCalendar')}
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default function EventsFilterClient({
  events,
  partnerAds = [],
}: {
  events: EventItem[]
  partnerAds?: PartnerAd[]
}) {
  const t = useTranslations('eventCalendar')
  const locale = useLocale()
  const [selectedCountry, setSelectedCountry] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [savedEventIds, setSavedEventIds] = useState<Set<number>>(new Set())
  const [calendarLoading, setCalendarLoading] = useState(true)

  useEffect(() => {
    async function loadCalendar() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const currentUserId = session?.user?.id ?? null
      setUserId(currentUserId)

      if (!currentUserId) {
        setCalendarLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('user_event_calendar')
        .select('event_master_id')
        .eq('user_id', currentUserId)

      if (!error && data) {
        setSavedEventIds(
          new Set(
            data.map((item) => Number(item.event_master_id))
          )
        )
      }

      setCalendarLoading(false)
    }

    loadCalendar()
  }, [])

  async function addEventToCalendar(eventId: number) {
    if (!userId || savedEventIds.has(eventId)) return

    const { error } = await supabase
      .from('user_event_calendar')
      .insert({
        user_id: userId,
        event_master_id: eventId,
        status: 'planned',
      })

    if (error) {
      console.error('Event konnte nicht zum Kalender hinzugefügt werden:', error)
      return
    }

    setSavedEventIds((current) => {
      const next = new Set(current)
      next.add(eventId)
      return next
    })
  }

  const countries = useMemo<CountryOption[]>(() => {
    const groupedCountries = new Map<string, number>()

    events.forEach((event) => {
      const code = event.countryCode?.trim().toUpperCase()
      if (!code || code.length !== 2) return

      const current = groupedCountries.get(code) ?? 0
      groupedCountries.set(code, current + 1)
    })

    return Array.from(groupedCountries.entries())
      .map(([code, count]) => ({
        code,
        label: countryNameFromCode(code),
        count,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'de'))
  }, [events])

  const filteredEvents = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return events.filter((event) => {
      const matchesCountry =
        !selectedCountry || event.countryCode?.toUpperCase() === selectedCountry

      const matchesSearch =
        !normalizedQuery ||
        event.city.toLowerCase().includes(normalizedQuery) ||
        event.country.toLowerCase().includes(normalizedQuery) ||
        event.brand.toLowerCase().includes(normalizedQuery) ||
        event.distances.toLowerCase().includes(normalizedQuery)

      return matchesCountry && matchesSearch
    })
  }, [events, selectedCountry, searchQuery])

  const adsByEvent = useMemo(() => eventAdIndex(partnerAds), [partnerAds])
  const featuredEvents = filteredEvents.filter(event => adsByEvent.has(event.id))

  const groupedEvents = useMemo<MonthGroup[]>(() => {
    const groups = new Map<string, MonthGroup>()

    filteredEvents.forEach((event) => {
      if (adsByEvent.has(event.id)) return
      const key = getMonthKey(event.date)
      const label = getMonthLabel(event.date, locale, t('noDate'))

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label,
          events: [],
        })
      }

      groups.get(key)?.events.push(event)
    })

    return Array.from(groups.values()).sort((a, b) =>
      a.key.localeCompare(b.key)
    )
  }, [filteredEvents, adsByEvent, locale, t])

  return (
    <>
      {userId ? (
        <div className="mb-6 flex justify-end">
          <Link
            href="/account/calendar"
            className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.07] px-5 py-3 text-sm font-semibold text-stone-100 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.12] hover:shadow-lg active:translate-y-0 active:scale-[0.98]"
          >
            <CalendarDays className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
            {t('myCalendar')}
          </Link>
        </div>
      ) : null}

      <div className="mb-6 flex flex-col gap-4">
        <div>
          <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-stone-500">
            {t('searchEvents')}
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none transition placeholder:text-stone-500 focus:border-white/20 focus:bg-black/20"
          />
        </div>

        {countries.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setSelectedCountry('')}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                selectedCountry === ''
                  ? 'border-stone-100 bg-stone-100 text-stone-950'
                  : 'border-white/10 bg-white/[0.04] text-stone-200 hover:border-white/20 hover:bg-white/[0.06]'
              }`}
            >
              <span>{t('allCountries')}</span>
            </button>

            {countries.map((country) => (
              <button
                key={country.code}
                type="button"
                onClick={() => setSelectedCountry(country.code)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                  selectedCountry === country.code
                    ? 'border-stone-100 bg-stone-100 text-stone-950'
                    : 'border-white/10 bg-white/[0.04] text-stone-200 hover:border-white/20 hover:bg-white/[0.06]'
                }`}
              >
                <span className="text-base">{countryToFlag(country.code)}</span>
                <span>{countryNameFromCode(country.code, locale)}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-stone-500">
        <span>
          {selectedCountry ? countryNameFromCode(selectedCountry, locale) : t('allCountries')}
        </span>
        <span>{t('eventCount', { count: filteredEvents.length })}</span>
      </div>

      {featuredEvents.length > 0 && (
        <div className="mb-8 grid gap-4 xl:grid-cols-2">
          {featuredEvents.map(event => (
            <EventCard key={event.id} event={event} ads={adsByEvent.get(event.id)} userId={userId}
              isSaved={savedEventIds.has(event.id)} calendarLoading={calendarLoading} onAddToCalendar={addEventToCalendar} />
          ))}
        </div>
      )}

      {groupedEvents.length > 0 ? (
        <>
          <div className="sticky top-0 z-20 mb-8 -mx-2 px-2 py-2">
            <div className="overflow-x-auto md:overflow-visible">
              <div className="flex w-max gap-2 rounded-[1.5rem] border border-white/10 bg-[#141312]/85 p-2 backdrop-blur-xl md:w-auto md:flex-wrap md:p-3">
                {groupedEvents.map((group) => (
                  <a
                    key={group.key}
                    href={`#month-${group.key}`}
                    className="whitespace-nowrap rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-stone-200 transition hover:border-white/20 hover:bg-white/[0.08] md:px-4 md:py-2 md:text-sm"
                  >
                    {group.label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-14">
            {groupedEvents.map((group) => (
              <section
                key={group.key}
                id={`month-${group.key}`}
                className="scroll-mt-32 pt-6 first:pt-0"
              >
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-2xl font-bold capitalize text-white">
                    {group.label}
                  </h3>
                  <span className="text-xs uppercase tracking-[0.2em] text-stone-500">
                    {t('eventCount', { count: group.events.length })}
                  </span>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  {group.events.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      userId={userId}
                      isSaved={savedEventIds.has(event.id)}
                      calendarLoading={calendarLoading}
                      onAddToCalendar={addEventToCalendar}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      ) : featuredEvents.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4 text-sm text-stone-400">
          {t('noneMatch')}
        </div>
      ) : null}
    </>
  )
}