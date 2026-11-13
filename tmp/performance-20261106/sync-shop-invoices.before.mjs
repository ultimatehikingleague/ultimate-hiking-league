// Local-only backup: export the stored, issued PDF; never regenerate invoices.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { parseEnv } from 'node:util'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const project = fileURLToPath(new URL('../', import.meta.url))
export const destination = '/Users/philippdobrinski/Documents/ChatGPT/Ultimate/Buchhaltung'

export function saveInvoice(invoice, base = destination) {
  if (!/^UHL-\d{4}-\d{6,}$/.test(invoice.number)) throw Error('Invalid invoice number')
  if (!invoice.pdf_base64) throw Error('Issued PDF missing: ' + invoice.number)
  const pdf = Buffer.from(invoice.pdf_base64, 'base64')
  if (pdf.subarray(0, 5).toString() !== '%PDF-') throw Error('Invalid PDF: ' + invoice.number)
  const year = invoice.number.split('-')[1]
  const directory = path.join(base, year, 'Ausgangsrechnungen')
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
  const target = path.join(directory, invoice.number + '.pdf')
  const digest = crypto.createHash('sha256').update(pdf).digest('hex')
  let created = false
  if (fs.existsSync(target)) {
    if (!fs.lstatSync(target).isFile() || !fs.readFileSync(target).equals(pdf)) {
      throw Error('Local copy differs; not overwritten: ' + invoice.number)
    }
  } else {
    const temporary = path.join(directory, '.' + crypto.randomUUID() + '.tmp')
    try {
      const fd = fs.openSync(temporary, 'wx', 0o400)
      try { fs.writeFileSync(fd, pdf); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
      // Atomic publication without replacing an existing file.
      try { fs.linkSync(temporary, target); created = true } catch (error) {
        if (error.code !== 'EEXIST' || !fs.lstatSync(target).isFile() || !fs.readFileSync(target).equals(pdf)) throw error
      }
    } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary) }
  }
  const checksum = digest + '  ' + path.basename(target) + '\n'
  try { fs.writeFileSync(target + '.sha256', checksum, { flag: 'wx', mode: 0o400 }) } catch (error) {
    if (error.code !== 'EEXIST' || fs.readFileSync(target + '.sha256', 'utf8') !== checksum) throw Error('Checksum conflict: ' + invoice.number)
  }
  return created
}

export async function syncInvoices() {
  const env = parseEnv(fs.readFileSync(path.join(project, '.env.local'), 'utf8'))
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw Error('Local database credentials missing')
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(30000) }) },
  })
  let exported = 0, checked = 0
  for (let offset = 0; ; offset += 100) {
    const result = await db.from('shop_invoices').select('number,pdf_base64')
      .eq('mode', 'live').order('number').range(offset, offset + 99)
    if (result.error) throw Error('Invoice lookup failed (' + result.error.code + ')')
    for (const invoice of result.data) { if (saveInvoice(invoice)) exported++; checked++ }
    if (result.data.length < 100) break
  }
  fs.mkdirSync(destination, { recursive: true, mode: 0o700 })
  fs.writeFileSync(path.join(destination, 'Rechnungsabgleich-Status.json'), JSON.stringify({
    lastSuccess: new Date().toISOString(), invoicesChecked: checked, newCopies: exported,
  }, null, 2) + '\n', { mode: 0o600 })
  console.log(new Date().toISOString() + ': invoice backup OK; checked=' + checked + '; new=' + exported)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  syncInvoices().catch(error => {
    // Do not log provider responses, credentials or customer data.
    console.error(new Date().toISOString() + ': invoice backup failed: ' + error.message)
    process.exitCode = 1
  })
}
