import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import { rankDistance } from '../app/lib/rankings.ts'

const source = fs.readFileSync(new URL('../app/home-page.tsx', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: {
  jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
} }).outputText
const hikers = [
  { id: 1, display_name: 'Lifetime', country: 'DE', division: 'gold', total_km: 200 },
  { id: 2, display_name: 'Season', country: 'AT', division: 'gold', total_km: 100 },
]
const season = [{ hiker_id: 1, season_km: 10 }, { hiker_id: 2, season_km: 50 }]
const jsx = (type, props) => ({ type: typeof type === 'function' ? type.name : type, props })

for (const year of [2026, 2027]) test('home rankings and no recent-activity query in ' + year, async () => {
  const tables = []
  const q = {select: () => q, eq: () => q, gte: () => q, order: () => q, limit: () => q,
    single: async () => ({ data: null }), then: resolve => resolve({ data: [] })}
  const clients = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'next-intl/server': { getTranslations: async () => Object.assign(key => key, { rich: key => key }), getLocale: async () => 'de' },
    '../i18n/client-scope': { clientScope: () => ({ children }) => children },
    './lib/supabase': {supabase: {from: table => { tables.push(table); return q }}},
    './lib/season': { getSeasonYear: () => year, SEASON_RANKINGS_START: 2027 },
    './lib/rankings': {
      fetchActiveHikers: async () => hikers, fetchSeasonRows: async () => season, rankDistance,
      fetchSkyscraperRanking: async () => [{ ...hikers[1], value: 1900 }], rankingResult: (_, value) => value,
    },
    './lib/partnerBookings': { getPartnerAds: async () => [] },
  }
  const fallback = new Proxy({__esModule:true,default:'Component'}, {get:(o,k)=>k in o?o[k]:String(k)})
  const exports = {}
  new Function('require', 'exports', compiled)(name => clients[name] ?? fallback, exports)
  const tree = JSON.stringify(await exports.default())
  assert.match(tree, /allTimeRanking/)
  assert.match(tree, /\/skyscraper/)
  assert.equal(tree.includes('topSeason'), year >= 2027)
  assert.doesNotMatch(tree, /latestActivities|allTimeReserved/)
  assert.deepEqual(tables.sort(), ['challenges', 'events_master', 'site_stats'])
})
