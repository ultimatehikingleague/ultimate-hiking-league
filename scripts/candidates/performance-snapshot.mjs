// Read-only, explicitly invoked diagnostics. Writes only aggregate counters locally.
import fs from 'node:fs'
import { parseEnv } from 'node:util'
const env = parseEnv(fs.readFileSync(new URL('../../.env.local', import.meta.url), 'utf8'))
const response = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/customer/v1/privileged/metrics', {
  headers: { Authorization: 'Basic ' + Buffer.from('service_role:' + env.SUPABASE_SERVICE_ROLE_KEY).toString('base64') },
  signal: AbortSignal.timeout(30000),
})
if (!response.ok) throw Error('Metrics HTTP ' + response.status)
const lines = (await response.text()).split('\n').filter(line => /^(node_memory_(MemTotal|MemAvailable|SwapTotal|SwapFree)_bytes|node_vmstat_pswp(in|out)|node_disk_(read_bytes_total|written_bytes_total|reads_completed_total|writes_completed_total)|node_boot_time_seconds|pg_stat_database_(temp_bytes|temp_files|deadlocks|xact_commit|xact_rollback))([ {])/.test(line))
const result = { capturedAt: new Date().toISOString(), counters: lines }
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(result, null, 2) + '\n', { mode: 0o600 })
console.log(JSON.stringify(result))
