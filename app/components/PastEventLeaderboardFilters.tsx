'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

type PastEventCard = {
  id: number
  slug: string
  title: string
  city: string
  country: string
  countryCode: string
  brand: string
  date: string
  distances: string
  monthKey: string
  monthLabel: string
}

function countryToFlag(countryCode?: string | null) {
  if (!countryCode) return ''
  const code = countryCode.trim().toUpperCase()
  if (code.length !== 2) return ''
  return String.fromCodePoint(
    ...[...code].map((char) => 127397 + char.charCodeAt(0))
  )
}

function PastEventLeaderboardCard({ event }: { event: PastEventCard }) {
  return (
    <Link
      href={`/events/${event.slug}`}
      className="group rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/10 transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="text-xl">
                {countryToFlag(event.countryCode)}
              </span>
              <h3 className="truncate text-2xl font-bold text-white">
                {event.city}
              </h3>
            </div>

            <p className="mt-1 text-sm text-stone-400">{event.country}</p>
          </div>

          <span className="inline-flex shrink-0 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs uppercase tracking-wide text-stone-200">
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
            <div className="mt-1 font-semibold text-white">
              {event.distances}
            </div>
          </div>
        </div>

        <div className="text-sm font-medium text-stone-300 transition group-hover:text-white">
          Zum Event-Ranking →
        </div>
      </div>
    </Link>
  )
}

export default function PastEventLeaderboardFilters({
  pastEvents,
}: {
  pastEvents: PastEventCard[]
}) {
  const [selectedMonth, setSelectedMonth] = useState<string>('all')
  const [selectedCountry, setSelectedCountry] = useState<string>('all')

  const months = useMemo(() => {
    const uniqueMonths = Array.from(
      new Map(
        pastEvents.map((event) => [
          event.monthKey,
          {
            key: event.monthKey,
            label: event.monthLabel,
          },
        ])
      ).values()
    )

    return uniqueMonths
  }, [pastEvents])

  const countries = useMemo(() => {
    const uniqueCountries = Array.from(
      new Map(
        pastEvents.map((event) => [
          event.countryCode || event.country,
          {
            key: event.countryCode || event.country,
            label: event.country,
            countryCode: event.countryCode,
          },
        ])
      ).values()
    )

    return uniqueCountries.sort((a, b) => a.label.localeCompare(b.label, 'de'))
  }, [pastEvents])

  const filteredEvents = useMemo(() => {
    return pastEvents.filter((event) => {
      const monthMatches =
        selectedMonth === 'all' || event.monthKey === selectedMonth

      const countryMatches =
        selectedCountry === 'all' ||
        (event.countryCode || event.country) === selectedCountry

      return monthMatches && countryMatches
    })
  }, [pastEvents, selectedMonth, selectedCountry])

  return (
    <div>
      <div className="mb-4">
        <div className="mb-2 text-xs uppercase tracking-[0.18em] text-stone-500">
          Monate
        </div>

        <div className="-mx-1 overflow-x-auto pb-2">
          <div className="flex min-w-max gap-2 px-1">
            <button
              type="button"
              onClick={() => setSelectedMonth('all')}
              className={`rounded-full px-4 py-2 text-sm transition ${
                selectedMonth === 'all'
                  ? 'bg-white text-black'
                  : 'border border-white/10 bg-white/[0.04] text-stone-200 hover:border-white/20 hover:bg-white/[0.06]'
              }`}
            >
              Alle Monate
            </button>

            {months.map((month) => (
              <button
                key={month.key}
                type="button"
                onClick={() => setSelectedMonth(month.key)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  selectedMonth === month.key
                    ? 'bg-white text-black'
                    : 'border border-white/10 bg-white/[0.04] text-stone-200 hover:border-white/20 hover:bg-white/[0.06]'
                }`}
              >
                {month.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-2 text-xs uppercase tracking-[0.18em] text-stone-500">
          Länder
        </div>

        <div className="-mx-1 overflow-x-auto pb-2">
          <div className="flex min-w-max gap-2 px-1">
            <button
              type="button"
              onClick={() => setSelectedCountry('all')}
              className={`rounded-full px-4 py-2 text-sm transition ${
                selectedCountry === 'all'
                  ? 'bg-white text-black'
                  : 'border border-white/10 bg-white/[0.04] text-stone-200 hover:border-white/20 hover:bg-white/[0.06]'
              }`}
            >
              Alle Länder
            </button>

            {countries.map((country) => (
              <button
                key={country.key}
                type="button"
                onClick={() => setSelectedCountry(country.key)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${
                  selectedCountry === country.key
                    ? 'bg-white text-black'
                    : 'border border-white/10 bg-white/[0.04] text-stone-200 hover:border-white/20 hover:bg-white/[0.06]'
                }`}
              >
                <span>{countryToFlag(country.countryCode)}</span>
                <span>{country.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredEvents.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredEvents.map((event) => (
            <PastEventLeaderboardCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-4 text-sm text-stone-400">
          Für diese Auswahl wurden keine vergangenen Event-Rankings gefunden.
        </div>
      )}
    </div>
  )
}