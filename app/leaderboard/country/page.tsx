'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import BrandHeader from '../../components/BrandHeader'
import LeaderboardSubnav from '../../components/LeaderboardSubnav'
import BackToHomeButton from '../../components/BackToHomeButton'

type RankedUser = {
  id: number
  display_name: string | null
  country: string | null
  division: string | null
  total_km: number
  rank: number
}

type CountryOption = {
  code: string
  label: string
  count: number
}

const PAGE_SIZE = 50

function countryToFlag(countryCode: string | null) {
  if (!countryCode) return '—'
  const code = countryCode.trim().toUpperCase()
  if (code.length !== 2) return '—'
  return String.fromCodePoint(
    ...[...code].map((char) => 127397 + char.charCodeAt(0))
  )
}

function countryNameFromCode(countryCode: string | null) {
  if (!countryCode) return 'Unbekannt'
  const code = countryCode.trim().toUpperCase()

  const names = new Intl.DisplayNames(['de'], { type: 'region' })
  return names.of(code) ?? code
}

function getDivisionBadgeClass(division: string | null) {
  switch (division) {
    case 'platinum':
      return 'border border-fuchsia-400/30 bg-fuchsia-400/12 text-fuchsia-200'
    case 'gold':
      return 'border border-yellow-400/30 bg-yellow-400/12 text-yellow-200'
    case 'silver':
    default:
      return 'border border-stone-300/25 bg-stone-300/10 text-stone-100'
  }
}

function getMedalOrRank(rank: number, useMedals: boolean) {
  if (useMedals) {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
  }

  return `#${rank}`
}

function getPageNumbers(currentPage: number, totalPages: number) {
  const pages: number[] = []

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i += 1) pages.push(i)
    return pages
  }

  pages.push(1)

  const start = Math.max(2, currentPage - 1)
  const end = Math.min(totalPages - 1, currentPage + 1)

  if (start > 2) pages.push(-1)

  for (let i = start; i <= end; i += 1) pages.push(i)

  if (end < totalPages - 1) pages.push(-2)

  pages.push(totalPages)

  return pages
}

async function fetchAllHikers() {
  const pageSize = 1000
  let from = 0
  let allRows: any[] = []

  while (true) {
    const { data, error } = await supabase
      .from('hikers')
      .select('id, display_name, country, division, total_km')
      .range(from, from + pageSize - 1)

    if (error || !data || data.length === 0) {
      break
    }

    allRows = allRows.concat(data)

    if (data.length < pageSize) {
      break
    }

    from += pageSize
  }

  return allRows
}

export default function CountryLeaderboardPage() {
  const [users, setUsers] = useState<RankedUser[]>([])
  const [countries, setCountries] = useState<CountryOption[]>([])
  const [selectedCountry, setSelectedCountry] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    async function loadCountryLeaderboard() {
      try {
        const hikers = await fetchAllHikers()

        if (!hikers || hikers.length === 0) {
          setLoading(false)
          return
        }

        const validHikers = hikers
          .map((hiker) => ({
            id: hiker.id,
            display_name: hiker.display_name,
            country:
              typeof hiker.country === 'string'
                ? hiker.country.trim().toUpperCase()
                : null,
            division: hiker.division,
            total_km:
              typeof hiker.total_km === 'number' && !Number.isNaN(hiker.total_km)
                ? hiker.total_km
                : 0,
          }))
          .filter(
            (hiker) =>
              hiker.total_km > 0 &&
              typeof hiker.country === 'string' &&
              hiker.country.length === 2
          )

        const groupedCountries = new Map<string, number>()

        validHikers.forEach((hiker) => {
          const current = groupedCountries.get(hiker.country as string) ?? 0
          groupedCountries.set(hiker.country as string, current + 1)
        })

        const countryOptions: CountryOption[] = Array.from(
          groupedCountries.entries()
        )
          .map(([code, count]) => ({
            code,
            label: countryNameFromCode(code),
            count,
          }))
          .sort((a, b) => a.label.localeCompare(b.label, 'de'))

        setCountries(countryOptions)

        const initialCountry = countryOptions[0]?.code ?? ''
        setSelectedCountry(initialCountry)

        if (initialCountry) {
          const rankedUsers: RankedUser[] = validHikers
            .filter((hiker) => hiker.country === initialCountry)
            .sort((a, b) => b.total_km - a.total_km)
            .map((hiker, index) => ({
              ...hiker,
              rank: index + 1,
            }))

          setUsers(rankedUsers)
        } else {
          setUsers([])
        }
      } catch (error) {
        console.error('Country ranking load error:', error)
      } finally {
        setLoading(false)
      }
    }

    void loadCountryLeaderboard()
  }, [])

  useEffect(() => {
    async function updateCountryRanking() {
      if (!selectedCountry) return

      try {
        const hikers = await fetchAllHikers()

        if (!hikers || hikers.length === 0) {
          setUsers([])
          return
        }

        const rankedUsers: RankedUser[] = hikers
          .map((hiker) => ({
            id: hiker.id,
            display_name: hiker.display_name,
            country:
              typeof hiker.country === 'string'
                ? hiker.country.trim().toUpperCase()
                : null,
            division: hiker.division,
            total_km:
              typeof hiker.total_km === 'number' && !Number.isNaN(hiker.total_km)
                ? hiker.total_km
                : 0,
            rank: 0,
          }))
          .filter((hiker) => hiker.total_km > 0 && hiker.country === selectedCountry)
          .sort((a, b) => b.total_km - a.total_km)
          .map((hiker, index) => ({
            ...hiker,
            rank: index + 1,
          }))

        setUsers(rankedUsers)
        setCurrentPage(1)
        setSearchQuery('')
      } catch (error) {
        console.error('Country ranking update error:', error)
      }
    }

    void updateCountryRanking()
  }, [selectedCountry])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const normalizedQuery = searchQuery.trim().toLowerCase()

  const filteredUsers = useMemo(() => {
    if (!normalizedQuery) return users

    return users.filter((user) =>
      (user.display_name ?? '').toLowerCase().includes(normalizedQuery)
    )
  }, [users, normalizedQuery])

  const isSearchMode = normalizedQuery.length > 0
  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE))

  const paginatedUsers = useMemo(() => {
    if (isSearchMode) return filteredUsers

    const start = (currentPage - 1) * PAGE_SIZE
    return users.slice(start, start + PAGE_SIZE)
  }, [users, filteredUsers, currentPage, isSearchMode])

  const selectedCountryLabel = selectedCountry
    ? countryNameFromCode(selectedCountry)
    : '—'

  const pageNumbers = getPageNumbers(currentPage, totalPages)

  return (
    <main className="min-h-screen bg-[#141312] text-stone-100">
      <section
        className="relative overflow-hidden border-b border-white/10"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgba(20,19,18,0.28), rgba(20,19,18,0.82)), url('/leaderboard-hero.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="mx-auto max-w-6xl px-6 py-12 md:px-10 md:py-16">
          <BrandHeader />
          

          <Link
            href="/leaderboard"
            className="inline-block text-sm text-stone-300 transition hover:text-white"
          >
            ← Zurück zu Ranglisten
          </Link>

          <div className="mt-4">
            <BackToHomeButton />
          </div>


          <div className="mt-6 max-w-3xl rounded-[2rem] border border-white/10 bg-black/25 p-6 shadow-2xl shadow-black/20 backdrop-blur-sm md:p-8">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-stone-300">
              Ranglisten
            </div>

            <h1 className="mt-2 text-4xl font-bold tracking-tight text-white md:text-5xl">
              Länderrangliste
            </h1>

            <p className="mt-3 text-sm leading-6 text-stone-300 md:text-base">
              Vergleiche Hiker innerhalb ihrer Nationalität. Sichtbar werden automatisch nur Länder mit echten Daten.
            </p>
          </div>

          <LeaderboardSubnav />
        </div>
        
      </section>
      

      <section className="px-6 py-10 md:px-10 md:py-12">
        <div className="mx-auto max-w-5xl">
          <div className="mb-5">
            <h2 className="text-2xl font-bold text-white">Länder auswählen</h2>
            <p className="mt-1 text-sm text-stone-400">
              Neue Länder erscheinen automatisch, sobald dort Hiker mit gepflegter Nationalität und gewerteten Kilometern vorhanden sind.
            </p>
          </div>

          <div className="mb-8 flex flex-wrap gap-3">
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
                <span>{country.label}</span>
              </button>
            ))}
          </div>

          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">
                {selectedCountry
                  ? `${countryToFlag(selectedCountry)} ${selectedCountryLabel}`
                  : 'Länderrangliste'}
              </h2>
              <p className="mt-1 text-sm text-stone-400">
                50 Hiker pro Seite. Bei der Suche bleibt der echte Rang sichtbar.
              </p>
            </div>

            <div className="w-full md:w-[340px]">
              <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-stone-500">
                Hiker suchen
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Name eingeben…"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-stone-500 focus:border-white/20 focus:bg-white/[0.06]"
              />
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-stone-500">
            <span>{selectedCountryLabel}</span>
            <span>
              {isSearchMode
                ? `${filteredUsers.length} Treffer`
                : `${users.length} Hiker · Seite ${currentPage} / ${totalPages}`}
            </span>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-stone-400">
                Lade Länderrangliste…
              </div>
            ) : paginatedUsers.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-stone-400">
                Noch keine passenden Hiker gefunden.
              </div>
            ) : (
              paginatedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 shadow-lg shadow-black/5 transition hover:bg-white/[0.06]"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="w-12 text-center text-xl font-bold text-white">
                      {getMedalOrRank(user.rank, !isSearchMode)}
                    </div>

                    <div className="min-w-0">
                      <Link
                        href={`/${user.id}`}
                        className="truncate font-semibold text-white transition hover:text-stone-300"
                      >
                        {user.display_name ?? 'Unbekannt'}
                      </Link>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-stone-400">
                        <span>
                          {countryToFlag(user.country)} {countryNameFromCode(user.country)}
                        </span>

                        <span>·</span>

                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs ${getDivisionBadgeClass(
                            user.division
                          )}`}
                        >
                          {user.division ?? 'silver'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-bold text-white">
                      {user.total_km} km
                    </div>
                    <div className="text-xs text-stone-400">
                      Gesamtleistung
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {!loading && !isSearchMode && totalPages > 1 ? (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white transition disabled:cursor-not-allowed disabled:opacity-40 hover:bg-white/[0.06]"
              >
                Zurück
              </button>

              {pageNumbers.map((page, index) =>
                page < 0 ? (
                  <span
                    key={`ellipsis-${index}`}
                    className="px-2 text-sm text-stone-500"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      currentPage === page
                        ? 'bg-white text-black'
                        : 'border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    {page}
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages}
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white transition disabled:cursor-not-allowed disabled:opacity-40 hover:bg-white/[0.06]"
              >
                Weiter
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}