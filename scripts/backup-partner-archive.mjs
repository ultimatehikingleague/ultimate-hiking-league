// Supplemental local export. Supabase's database backups retain the full consistent snapshot.
import { createHash } from 'node:crypto'
import { chmod, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { gzipSync, gunzipSync } from 'node:zlib'

const tables = {
  partners: 'id',
  partner_bookings: 'id',
  partner_dossiers: 'booking_id',
  partner_cooperations: 'booking_id',
  partner_placement_approvals: 'booking_id',
  partner_placement_history: 'id',
  partner_social_mentions: 'booking_id',
}
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const pageSize = 12

export async function backupPartnerArchive(destination, readPage) {
  await mkdir(destination, { recursive: true, mode: 0o700 })
  const staging = await mkdtemp(resolve(destination, '.partner-backup-'))
  try {
    await chmod(staging, 0o700)
    const exportedAt = new Date().toISOString()
    const manifest = { exportedAt, tables: {} }
    for (const [table, key] of Object.entries(tables)) {
      let after
      const pages = []
      let count = 0
      for (;;) {
        const page = await readPage(table, key, after, pageSize)
        if (!Array.isArray(page) || page.length > pageSize) throw Error('Ungültiger Export: ' + table)
        for (const row of page) {
          const id = row[key]
          if (id == null || (after != null && id <= after)) throw Error('Ungültige Exportreihenfolge: ' + table)
          after = id
          if (table === 'partner_dossiers') {
            for (const column of ['offer_pdf', 'contract_pdf', 'payment_request_pdf', 'invoice_pdf']) {
              if (row[column] != null && Buffer.from(row[column], 'base64').subarray(0, 5).toString() !== '%PDF-')
                throw Error('Ungültiges archiviertes PDF: ' + column)
            }
          }
        }
        if (page.length) {
          const filename = table + '-' + (pages.length + 1) + '.json.gz'
          const path = resolve(staging, filename)
          const raw = JSON.stringify(page)
          await writeFile(path, gzipSync(raw), { flag: 'wx', mode: 0o400 })
          const stored = await readFile(path)
          if (gunzipSync(stored).toString() !== raw) throw Error('Prüflesen fehlgeschlagen: ' + table)
          pages.push({ filename, sha256: sha256(stored) })
          count += page.length
        }
        if (page.length < pageSize) break
      }
      manifest.tables[table] = { count, pages }
    }
    await writeFile(resolve(staging, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o400 })
    const target = resolve(destination, exportedAt.replace(/[:.]/g, '-') + '-' + staging.slice(-6))
    await rename(staging, target)
    return { target, counts: Object.fromEntries(Object.entries(manifest.tables).map(([table, entry]) => [table, entry.count])) }
  } catch (error) {
    await rm(staging, { recursive: true, force: true })
    throw error
  }
}

if (process.argv[1] && resolve(process.argv[1]) === decodeURIComponent(new URL(import.meta.url).pathname)) {
  const destination = process.argv[2]
  if (!destination) throw Error('Zielordner für das private Partnerarchiv angeben.')
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url.protocol !== 'https:' || url.hostname !== 'astdepkrdkmufsydxviz.supabase.co' || !service) {
    throw Error('Produktives UHL-Projekt oder Zugangsdaten stimmen nicht.')
  }
  const result = await backupPartnerArchive(resolve(destination), async (table, key, after, limit) => {
    const address = new URL('/rest/v1/' + table, url)
    address.searchParams.set('order', key + '.asc')
    address.searchParams.set('limit', String(limit))
    if (after != null) address.searchParams.set(key, 'gt.' + after)
    const response = await fetch(address, {
      headers: { apikey: service, Authorization: 'Bearer ' + service },
      signal: AbortSignal.timeout(30000),
    })
    if (!response.ok) throw Error('Export fehlgeschlagen: ' + table + ' HTTP ' + response.status)
    return response.json()
  })
  console.log(JSON.stringify(result))
}
