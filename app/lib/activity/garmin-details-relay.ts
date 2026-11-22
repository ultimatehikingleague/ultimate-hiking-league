import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type { normalizeGarminPush } from './garmin-push.server'

export const detailsRelayPath = '/api/garmin/details-relay'
export const detailsRelayMaxBytes = 128 * 1024
export const detailsRelayBatchSize = 40

export function detailsRelayKey(value: string | undefined) {
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? Buffer.from(value, 'base64url') : null
}

export function detailsRelaySignature(key: Buffer, timestamp: string, body: string) {
  return createHmac('sha256', key).update(`v1\nPOST\n${detailsRelayPath}\n${timestamp}\n`).update(body).digest('hex')
}

export function validDetailsRelaySignature(key: Buffer, timestamp: string, body: string, signature: string, now = Date.now()) {
  return /^\d{10}$/.test(timestamp) && Math.abs(now / 1000 - Number(timestamp)) <= 120 &&
    /^[a-f0-9]{64}$/.test(signature) &&
    timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(detailsRelaySignature(key, timestamp, body), 'hex'))
}

export function detailsRelayItem({ userId, file, ...payload }: ReturnType<typeof normalizeGarminPush>[number]) {
  if (file !== null) throw new Error('Unexpected file in activity details')
  const fingerprint = createHash('sha256').update(JSON.stringify({ ...payload, file })).digest('hex')
  return { garmin_user_id: userId, fingerprint, payload }
}
