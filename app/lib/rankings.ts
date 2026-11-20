import { supabase } from './supabase'
import { SEASON_RANKINGS_START } from './season'

const PAGE_SIZE = 1000
export const SKYSCRAPER_THRESHOLD = 1500
export const LEAGUE_DIVISIONS = ['platinum', 'gold', 'silver'] as const
type Division = typeof LEAGUE_DIVISIONS[number]

type RankedHiker = {
  id: number
  display_name: string | null
  country: string | null
  division: string | null
  total_km: number
  rank: number
}

type Hiker = Omit<RankedHiker, 'rank' | 'total_km'> & { total_km: number | null }
type SeasonRow = { hiker_id: number; season_km: number | null; season_elevation_gain: number | null }

async function readPages<Row>(
  read: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: unknown }>,
) {
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await read(from, from + PAGE_SIZE - 1)
    if (error) throw error
    if (!data?.length) return rows
    rows.push(...data)
    if (data.length < PAGE_SIZE) return rows
  }
}

export function fetchActiveHikers(division?: Division) {
  return readPages<Hiker>((from, to) => {
    const query = supabase.from('hikers')
      .select('id, display_name, country, division, total_km')
      .eq('profile_status', 'active')
    if (division) query.eq('division', division)
    return query.order('id').range(from, to)
  })
}

export function fetchSeasonRows(year: number) {
  return readPages<SeasonRow>((from, to) => supabase.from('hiker_season_stats')
    .select('hiker_id, season_km, season_elevation_gain')
    .eq('season_year', year)
    .order('hiker_id')
    .range(from, to))
}

export function rankDistance(
  hikers: Hiker[],
  seasonRows?: SeasonRow[],
  includeZero = false,
): RankedHiker[] {
  const seasonKm = seasonRows && new Map(seasonRows.map(row => [row.hiker_id, row.season_km]))
  return hikers
    .map(hiker => ({
      ...hiker,
      total_km: Number((seasonKm ? seasonKm.get(hiker.id) : hiker.total_km) ?? 0),
    }))
    .filter(hiker => includeZero || hiker.total_km > 0)
    .sort((a, b) => b.total_km - a.total_km || a.id - b.id)
    .map((hiker, index) => ({ ...hiker, rank: index + 1 }))
}

export async function fetchDistanceRanking(year?: number, division?: Division) {
  const [hikers, seasonRows] = await Promise.all([
    fetchActiveHikers(division),
    year === undefined ? undefined : fetchSeasonRows(year),
  ])
  return rankDistance(hikers, seasonRows, year !== undefined && division !== undefined)
}

export async function fetchSkyscraperRanking(
  year: number,
  hikers = fetchActiveHikers(),
  seasonRows = fetchSeasonRows(year),
) {
  const [activeHikers, rows] = await Promise.all([hikers, seasonRows])
  const elevationByHiker = new Map(rows.map(row => [row.hiker_id, Number(row.season_elevation_gain ?? 0)]))
  return activeHikers
    .map(hiker => ({ ...hiker, totalElevation: elevationByHiker.get(hiker.id) ?? 0 }))
    .filter(hiker => hiker.totalElevation >= SKYSCRAPER_THRESHOLD)
    .sort((a, b) => b.totalElevation - a.totalElevation || a.id - b.id)
    .map((hiker, index) => ({ ...hiker, rank: index + 1 }))
}

export async function rankingResult<Row>(label: string, request: Promise<Row>) {
  try {
    return await request
  } catch (error) {
    console.error(`${label} ranking load error:`, error)
    return null
  }
}

export async function fetchProfileRanking(id: number, year: number) {
  const hikers = fetchActiveHikers()
  const useSeason = year >= SEASON_RANKINGS_START
  const season = fetchSeasonRows(year)
  const [activeHikers, seasonRows, skyscraper] = await Promise.all([
    rankingResult('Active hikers', hikers),
    useSeason ? rankingResult('Season', season) : undefined,
    rankingResult('Skyscraper', fetchSkyscraperRanking(year, hikers, season)),
  ])

  const division = activeHikers?.find(hiker => hiker.id === id)?.division
  const canRankDistance = activeHikers && seasonRows !== null
  const overall = canRankDistance
    ? rankDistance(activeHikers, seasonRows).find(hiker => hiker.id === id)?.rank ?? null
    : null
  const divisionRank = canRankDistance && division
    ? rankDistance(activeHikers.filter(hiker => hiker.division === division), seasonRows, useSeason)
        .find(hiker => hiker.id === id)?.rank ?? null
    : null

  return {
    overall,
    division: divisionRank,
    skyscraper: skyscraper?.find(hiker => hiker.id === id)?.rank ?? null,
    skyscraperUnavailable: skyscraper === null,
  }
}
