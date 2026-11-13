import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { incrementalInvoiceBackup } from '../scripts/candidates/incremental-invoice-backup.mjs'

function database(rows) {
  return { from(table) {
    assert.equal(table, 'shop_invoices')
    let fields, after, number, limit
    const query = {
      select(v) { fields = v; return this },
      eq(k,v) { if(k === 'mode') assert.equal(v,'live'); else if(k === 'number') number=v; else assert.fail(k); return this },
      order(k) { assert.equal(k,'number'); return this },
      gt(k,v) { assert.equal(k,'number'); after=v; return this },
      limit(v) { limit=v; return this },
      single() { return Promise.resolve({data:rows.find(r=>r.number===number)}) },
      then(resolve,reject) { assert.equal(fields,'number'); return Promise.resolve({data: rows.filter(r=>!after || r.number>after).slice(0,limit).map(({number})=>({number}))}).then(resolve,reject) },
    }; return query
  } }
}

test('incremental backup: pagination, warm run, late PDF, deletion, corruption and remote audit', async () => {
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'incremental-invoices-'))
  const rows=[1,2,3].map(n=>({number:`UHL-2026-00000${n}`,pdf_base64:Buffer.from('%PDF-original'+n).toString('base64')}))
  const run=(options={})=>incrementalInvoiceBackup({db:database(rows),base,pageSize:2,...options})
  const file=path.join(base,'2026/Ausgangsrechnungen',rows[0].number+'.pdf')
  try {
    assert.equal((await run()).pdfsDownloaded,3)
    const warm=await run(); assert.equal(warm.pdfsDownloaded,0); assert.equal(warm.queries,2)
    fs.unlinkSync(file+'.sha256'); assert.equal((await run()).pdfsDownloaded,1)
    fs.unlinkSync(file); assert.equal((await run()).newCopies,1)
    rows[0].pdf_base64=Buffer.from('%PDF-changed').toString('base64')
    await assert.rejects(run({fullVerify:true}),/not overwritten/)
    fs.chmodSync(file,0o600); fs.writeFileSync(file,'%PDF-corrupt')
    await assert.rejects(run(),/checksum mismatch/)
    rows.push({number:'UHL-2026-000004',pdf_base64:null})
    fs.rmSync(path.dirname(file),{recursive:true})
    await assert.rejects(run(),/missing/)
    rows[3].pdf_base64=Buffer.from('%PDF-late').toString('base64')
    assert.equal((await run()).newCopies,1)
  } finally { fs.rmSync(base,{recursive:true,force:true}) }
})

test('scheduled backup verifies initially/weekly, keeps last success on failure, and prevents overlap', async () => {
  const {runIncrementalBackup}=await import('../scripts/candidates/run-incremental-invoice-backup.mjs')
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'scheduled-invoices-'))
  const rows=[{number:'UHL-2026-000001',pdf_base64:Buffer.from('%PDF-test').toString('base64')}]
  const run=(date,extra={})=>runIncrementalBackup({db:database(rows),base,now:new Date(date),...extra})
  try {
    const initial=await run('2026-11-06T10:00:00Z'); assert.equal(initial.fullVerify,true)
    const warm=await run('2026-11-06T10:05:00Z'); assert.equal(warm.pdfsDownloaded,0); assert.equal(warm.lastFullVerification,initial.lastFullVerification)
    assert.equal((await run('2026-11-13T10:00:00Z')).fullVerify,true)
    const status=fs.readFileSync(path.join(base,'Rechnungsabgleich-Status.json'),'utf8')
    rows[0].pdf_base64=Buffer.from('%PDF-changed').toString('base64')
    await assert.rejects(run('2026-11-20T10:00:00Z'),/not overwritten/)
    assert.equal(fs.readFileSync(path.join(base,'Rechnungsabgleich-Status.json'),'utf8'),status)
    assert.equal(fs.existsSync(path.join(base,'.Rechnungsabgleich.lock')),false)
    fs.writeFileSync(path.join(base,'.Rechnungsabgleich.lock'),'occupied')
    await assert.rejects(run('2026-11-20T10:01:00Z'),/locked/)
    assert.equal(fs.readFileSync(path.join(base,'.Rechnungsabgleich.lock'),'utf8'),'occupied')
  } finally {fs.rmSync(base,{recursive:true,force:true})}
})
