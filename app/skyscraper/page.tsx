'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import BrandHeader from '../components/BrandHeader'
import LeaderboardSubnav from '../components/LeaderboardSubnav'
import BackToHomeButton from '../components/BackToHomeButton'

type RankedUser = {
  id: number
  display_name: string | null
  country: string | null
  totalElevation: number
  rank: number
}

const PAGE_SIZE = 50
const MIN_ELEVATION = 1500

function countryToFlag(countryCode: string | null) {
  if (!countryCode) return '—'
  const code = countryCode.trim().toUpperCase()
  if (code.length !== 2) return '—'
  return String.fromCodePoint(
    ...[...code].map((char) => 127397 + char.charCodeAt(0))
  )
}

function getRankDisplay(rank: number, useMedals: boolean) {
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
      .select('id, display_name, country')
      .range(from, from + pageSize - 1)

    if (error || !data || data.length === 0) break

    allRows = allRows.concat(data)

    if (data.length < pageSize) break

    from += pageSize
  }

  return allRows
}

async function fetchAllElevationRecords() {
  const pageSize = 1000
  let from = 0
  let allRows: any[] = []

  while (true) {
    const { data, error } = await supabase
      .from('records')
      .select('hiker_id, elevation_gain')
      .range(from, from + pageSize - 1)

    if (error || !data || data.length === 0) break

    allRows = allRows.concat(data)

    if (data.length < pageSize) break

    from += pageSize
  }

  return allRows
}

export default function SkyscraperPage() {
  const [users, setUsers] = useState<RankedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    async function loadRanking() {
      try {
        const [hikers, records] = await Promise.all([
          fetchAllHikers(),
          fetchAllElevationRecords(),
        ])

        if (!hikers || hikers.length === 0 || !records || records.length === 0) {
          setLoading(false)
          return
        }

        const elevationByHiker = new Map<number, number>()

        records.forEach((record: any) => {
          const hikerId = record.hiker_id
          const elevation =
            typeof record.elevation_gain === 'number' &&
            !Number.isNaN(record.elevation_gain)
              ? record.elevation_gain
              : 0

          if (!hikerId || elevation <= 0) return

          const current = elevationByHiker.get(hikerId) ?? 0
          elevationByHiker.set(hikerId, current + elevation)
        })

        const rankedUsers: RankedUser[] = hikers
          .map((hiker: any) => ({
            id: hiker.id,
            display_name: hiker.display_name,
            country: hiker.country,
            totalElevation: elevationByHiker.get(hiker.id) ?? 0,
            rank: 0,
          }))
          .filter((user) => user.totalElevation >= MIN_ELEVATION)
          .sort((a, b) => b.totalElevation - a.totalElevation)
          .map((user, index) => ({
            ...user,
            rank: index + 1,
          }))

        setUsers(rankedUsers)
      } catch (error) {
        console.error('Skyscraper ranking load error:', error)
      } finally {
        setLoading(false)
      }
    }

    void loadRanking()
  }, [])

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
              Skyscraper Ranking
            </h1>

            <p className="mt-3 text-sm leading-6 text-stone-300 md:text-base">
              Die Höhenmeter-Rangliste der Liga. Sichtbar ab mindestens {MIN_ELEVATION}{' '}
              hm Gesamtleistung.
            </p>
          </div>

          <LeaderboardSubnav />
        </div>
      </section>

      <section className="px-6 py-10 md:px-10 md:py-12">
        <div className="mx-auto max-w-5xl">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Skyscraper</h2>
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
            <span>Elevation</span>
            <span>
              {isSearchMode
                ? `${filteredUsers.length} Treffer`
                : `${users.length} Hiker · Seite ${currentPage} / ${totalPages}`}
            </span>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-stone-400">
                Lade Ranking…
              </div>
            ) : paginatedUsers.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-stone-400">
                Keine passenden Hiker gefunden.
              </div>
            ) : (
              paginatedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 shadow-lg shadow-black/5 transition hover:bg-white/[0.06]"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="w-12 text-center text-xl font-bold text-white">
                      {getRankDisplay(user.rank, !isSearchMode)}
                    </div>

                    <div className="min-w-0">
                      <Link
                        href={`/${user.id}`}
                        className="truncate font-semibold text-white transition hover:text-stone-300"
                      >
                        {user.display_name ?? 'Unbekannt'}
                      </Link>

                      <div className="mt-1 text-sm text-stone-400">
                        {countryToFlag(user.country)} {user.country ?? '—'}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-bold text-white">
                      {user.totalElevation} hm
                    </div>
                    <div className="text-xs text-stone-400">Höhenmeter</div>
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