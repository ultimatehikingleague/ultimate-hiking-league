// Scheduler integration; credentials are still loaded only by the existing entry point.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { incrementalInvoiceBackup } from './incremental-invoice-backup.mjs'

const WEEK = 7 * 24 * 60 * 60 * 1000
export async function runIncrementalBackup({ db, base, forceFull = false, now = new Date() }) {
  fs.mkdirSync(base, { recursive: true, mode: 0o700 })
  const lock = path.join(base, '.Rechnungsabgleich.lock')
  const statusFile = path.join(base, 'Rechnungsabgleich-Status.json')
  let fd
  try { fd = fs.openSync(lock, 'wx', 0o600) } catch (error) {
    if (error.code === 'EEXIST') throw Error('Backup locked; check active process before removing stale lock')
    throw error
  }
  let temporary
  try {
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: now.toISOString() }))
    let previous = {}
    try { previous = JSON.parse(fs.readFileSync(statusFile, 'utf8')) } catch (error) {
      if (error.code !== 'ENOENT') throw Error('Backup status unreadable; full verification required after repair')
    }
    const lastFull = Date.parse(previous.lastFullVerification || '')
    const fullVerify = forceFull || !Number.isFinite(lastFull) || lastFull > now.getTime() || now.getTime() - lastFull >= WEEK
    const metrics = await incrementalInvoiceBackup({ db, base, fullVerify })
    const status = {
      version: 2, ...metrics, lastSuccess: now.toISOString(),
      lastFullVerification: fullVerify ? now.toISOString() : previous.lastFullVerification,
    }
    temporary = path.join(base, '.Rechnungsabgleich-' + crypto.randomUUID() + '.tmp')
    const statusFd = fs.openSync(temporary, 'wx', 0o600)
    try { fs.writeFileSync(statusFd, JSON.stringify(status, null, 2) + '\n'); fs.fsyncSync(statusFd) } finally { fs.closeSync(statusFd) }
    fs.renameSync(temporary, statusFile)
    return status
  } finally {
    if (temporary && fs.existsSync(temporary)) fs.unlinkSync(temporary)
    fs.closeSync(fd)
    fs.unlinkSync(lock)
  }
}
