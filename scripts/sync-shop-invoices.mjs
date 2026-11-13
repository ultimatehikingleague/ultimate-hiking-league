// Local-only backup: export the stored, issued PDF; never regenerate invoices.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.error('Rechnungssicherung ist nur über die Shop-Administration verfügbar.')
  process.exitCode = 1
}
