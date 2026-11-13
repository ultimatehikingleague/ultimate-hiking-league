// Small sequential sample, no load test. Never calls checkout or worker endpoints.
import fs from 'node:fs'
const [output, origin = 'https://www.ultimatehikingleague.com'] = process.argv.slice(2)
if (!output || !/^https:\/\/[a-z0-9.-]+$/.test(origin)) throw Error('Output and HTTPS origin required')
const results = []
for (const pathname of ['/', '/', '/', '/leaderboard/overall', '/division/gold', '/shop', '/shop/schorschys-wanderkalender-2027']) {
  const start = performance.now()
  const response = await fetch(origin + pathname, { signal: AbortSignal.timeout(30000) })
  const headersMs = Math.round(performance.now() - start)
  const bytes = (await response.arrayBuffer()).byteLength
  results.push({ pathname, status: response.status, headersMs, totalMs: Math.round(performance.now() - start), bytes, cache: response.headers.get('x-vercel-cache') })
}
const result = { capturedAt: new Date().toISOString(), origin, results }
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result))
