// Incremental backup core; credentials and scheduling stay in the existing entry point.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { saveInvoice } from '../sync-shop-invoices.mjs'

function verifiedLocal(number, base) {
  if (!/^UHL-\d{4}-\d{6,}$/.test(number)) throw Error('Invalid invoice number')
  const file = path.join(base, number.split('-')[1], 'Ausgangsrechnungen', number + '.pdf')
  if (!fs.existsSync(file)) return false
  if (!fs.lstatSync(file).isFile()) throw Error('Unsafe local PDF')
  const bytes = fs.readFileSync(file)
  if (bytes.subarray(0, 5).toString() !== '%PDF-') throw Error('Invalid local PDF')
  const checksum = file + '.sha256'
  // Missing sidecar requires an authoritative comparison before recreating it.
  if (!fs.existsSync(checksum)) return false
  if (!fs.lstatSync(checksum).isFile()) throw Error('Unsafe local checksum')
  const expected = crypto.createHash('sha256').update(bytes).digest('hex') + '  ' + path.basename(file) + '\n'
  if (fs.readFileSync(checksum, 'utf8') !== expected) throw Error('Local checksum mismatch')
  return true
}

export async function incrementalInvoiceBackup({ db, base, fullVerify = false, pageSize = 100 }) {
  if (!base || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw Error('Invalid backup options')
  const started = performance.now()
  const metrics = { invoicesChecked: 0, localVerified: 0, pdfsDownloaded: 0, pdfBytesDownloaded: 0, newCopies: 0, queries: 0, fullVerify }
  let after
  for (;;) {
    // Scan all metadata every run; no timestamp watermark that could miss late PDFs.
    let query = db.from('shop_invoices').select('number').eq('mode', 'live').order('number').limit(pageSize)
    if (after) query = query.gt('number', after)
    const result = await query
    metrics.queries++
    if (result.error || !Array.isArray(result.data)) throw Error('Invoice metadata lookup failed')
    for (const row of result.data) {
      if (after && row.number <= after) throw Error('Invoice pagination did not advance')
      const local = verifiedLocal(row.number, base)
      if (local) metrics.localVerified++
      if (fullVerify || !local) {
        const pdf = await db.from('shop_invoices').select('number,pdf_base64').eq('mode', 'live').eq('number', row.number).single()
        metrics.queries++
        if (pdf.error || !pdf.data || pdf.data.number !== row.number) throw Error('Issued PDF lookup failed')
        metrics.pdfsDownloaded++
        metrics.pdfBytesDownloaded += Buffer.from(pdf.data.pdf_base64 || '', 'base64').length
        if (saveInvoice(pdf.data, base)) metrics.newCopies++
      }
      metrics.invoicesChecked++
      after = row.number
    }
    if (result.data.length < pageSize) break
  }
  return { ...metrics, durationMs: Math.round(performance.now() - started) }
}
