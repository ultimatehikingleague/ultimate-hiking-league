import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { saveInvoice } from '../scripts/sync-shop-invoices.mjs'

test('invoice backup is repeatable and refuses changed PDFs or unsafe names', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'invoice-backup-'))
  try {
    const invoice = { number: 'UHL-2026-000001', pdf_base64: Buffer.from('%PDF-original').toString('base64') }
    assert.equal(saveInvoice(invoice, directory), true)
    assert.equal(saveInvoice(invoice, directory), false)
    assert.throws(() => saveInvoice({ ...invoice, pdf_base64: Buffer.from('%PDF-changed').toString('base64') }, directory), /not overwritten/)
    assert.equal(fs.readFileSync(path.join(directory, '2026/Ausgangsrechnungen/UHL-2026-000001.pdf'), 'utf8'), '%PDF-original')
    assert.throws(() => saveInvoice({ ...invoice, number: '../escape' }, directory), /Invalid invoice number/)
    assert.throws(() => saveInvoice({ ...invoice, pdf_base64: null }, directory), /missing/)
  } finally { fs.rmSync(directory, { recursive: true, force: true }) }
})
