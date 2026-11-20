'use client'

import { useLocale, useTranslations } from 'next-intl'
import { LiveBrandPlacement } from '../../components/PartnerPlacements'
import { formatRankingDistance } from '../../../i18n/display'
import { useEffect, useMemo, useState } from 'react'
import Link from '@/i18n/prototype/LocalizedLink'
import { fetchDistanceRanking, rankingResult } from '../../lib/rankings'
import { getSeasonYear, SEASON_RANKINGS_START } from '../../lib/season'
import SeasonRefresh from '../../components/SeasonRefresh'
import BrandHeader from '../../components/BrandHeader'
import BackToHomeButton from '../../components/BackToHomeButton'

type RankedUser = {
  id: number
  display_name: string | null
  country: string | null
  division: string | null
  total_km: number
  rank: number
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

export default function GoldPage() {
  const t = useTranslations('ui')
  const locale = useLocale()
  const year = getSeasonYear()
  const useSeason = year >= SEASON_RANKINGS_START
  const rankingKey = useSeason ? year : 0
  const [result, setResult] = useState<{ key: number; rows: RankedUser[] | null } | null>(null)
  const currentResult = result?.key === rankingKey ? result : null
  const users = useMemo(() => currentResult?.rows ?? [], [currentResult])
  const loading = currentResult === null
  const failed = currentResult?.rows === null
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    let cancelled = false
    void rankingResult('Gold', fetchDistanceRanking(useSeason ? year : undefined, 'gold')).then(ranking => {
      if (cancelled) return
      setResult({ key: rankingKey, rows: ranking })
      setCurrentPage(1)
    })
    return () => { cancelled = true }
  }, [rankingKey, useSeason, year])

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
      <SeasonRefresh />
      <section
        className="relative overflow-hidden border-b border-white/10"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgba(20,19,18,0.24), rgba(20,19,18,0.82)), url('/division-detail-hero.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="mx-auto max-w-6xl px-6 py-12 md:px-10 md:py-16">
          <BrandHeader />

          <Link
            href="/division"
            className="inline-block text-sm text-stone-300 transition hover:text-white"
          >{t("backToDivisions")}</Link>

          <div className="mt-2">
            <BackToHomeButton />
          </div>

          <div className="mt-6 max-w-3xl rounded-[2rem] border border-white/10 bg-black/25 p-6 shadow-2xl shadow-black/20 backdrop-blur-sm md:p-8">
            <div className="inline-flex rounded-full border border-yellow-400/30 bg-yellow-400/12 px-3 py-1.5 text-sm text-yellow-200">
              Gold
            </div>

            <h1 className="mt-4 text-4xl font-bold text-white md:text-5xl">
              Gold Division
            </h1>

            <p className="mt-3 text-sm leading-6 text-stone-300 md:text-base">{t("goldDescription")}</p>
          </div>
        </div>
      </section>

      <section className="px-6 py-10 md:px-10 md:py-12">
        <LiveBrandPlacement surface="rankings" />
        <div className="mx-auto max-w-5xl">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">{t('divisionRankingLabel', { division: 'Gold' })}</h2>
              <p className="mt-1 text-sm text-stone-400">{t("paginationHint")}</p>
            </div>

            <div className="w-full md:w-[340px]">
              <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-stone-500">{t("searchHikers")}</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder={t("namePlaceholder")}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-stone-500 focus:border-white/20 focus:bg-white/[0.06]"
              />
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-stone-500">
            <span>{useSeason ? t('seasonRanking', { year }) : 'Gold'}</span>
            <span>
              {isSearchMode
                ? t('found', { count: filteredUsers.length })
                : `${t('numberOfHikers', { count: users.length })} · ${t('pageOf', { current: currentPage, count: totalPages })}`}
            </span>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-stone-400">{t("loadingDivision")}</div>
            ) : failed ? (
              <p role="status" className="text-sm text-stone-400">{t('rankingUnavailable')}</p>
            ) : users.length === 0 ? (
              <p className="text-sm text-stone-400">{t('rankingEmpty')}</p>
            ) : paginatedUsers.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-stone-400">{t("noHikers")}</div>
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
                      {formatRankingDistance(user.total_km, locale)} km
                    </div>
                    <div className="text-xs text-stone-400">gold</div>
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
              >{t("back")}</button>

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
              >{t("next")}</button>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}