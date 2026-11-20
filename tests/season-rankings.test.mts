import assert from 'node:assert/strict'
import test from 'node:test'
import { getSeasonYear, nextSeasonStart } from '../app/lib/season'
import { rankDistance, rankingResult } from '../app/lib/rankings'

const hikers = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
  display_name: null,
  country: 'DE',
  division: 'gold',
  total_km: 1000 - index,
}))

test('Berlin season changes at midnight independently of host time', () => {
  const rollover = Date.parse('2026-12-31T23:00:00Z')
  assert.equal(getSeasonYear(new Date(rollover - 1)), 2026)
  assert.equal(getSeasonYear(new Date(rollover)), 2027)
  assert.equal(nextSeasonStart(2026), rollover)
  assert.equal(nextSeasonStart(2027), Date.parse('2027-12-31T23:00:00Z'))
})

test('season ordering precedes the top ten and breaks ties by hiker ID', () => {
  const seasonRows = hikers.map(hiker => ({
    hiker_id: hiker.id, season_km: Math.ceil(hiker.id / 2), season_elevation_gain: 0,
  }))
  seasonRows.push({ hiker_id: 99, season_km: 500, season_elevation_gain: 1500 })
  assert.deepEqual(rankDistance(hikers, seasonRows).slice(0, 10).map(row => row.id), [11, 12, 9, 10, 7, 8, 5, 6, 3, 4])
  assert.deepEqual(rankDistance(hikers).slice(0, 10).map(row => row.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
})

test('missing season rows give zero only in division lists and preserve lifetime data', () => {
  assert.deepEqual(rankDistance(hikers, []), [])
  assert.deepEqual(rankDistance(hikers, [], true).map(row => row.total_km), Array(hikers.length).fill(0))
  assert.equal(rankDistance(hikers)[0].total_km, 1000)
})

test('a failed query is distinguishable from a successful empty result', async () => {
  assert.equal(await rankingResult('Fixture', Promise.reject(new Error('Offline'))), null)
  assert.deepEqual(await rankingResult('Fixture', Promise.resolve([])), [])
})
