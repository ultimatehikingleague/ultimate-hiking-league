import { garminResponse, garminServiceConfiguration } from '../../../lib/activity/garmin-connection.server'
import {
  detailsRelayBatchSize, detailsRelayKey, detailsRelayMaxBytes, validDetailsRelaySignature,
} from '../../../lib/activity/garmin-details-relay'

export async function POST(request: Request) {
  const key = detailsRelayKey(process.env.GARMIN_DETAILS_RELAY_KEY)
  if (!key || process.env.GARMIN_PUSH_ENABLED !== 'true') return garminResponse(404)
  const timestamp = request.headers.get('x-garmin-relay-time') ?? ''
  const signature = request.headers.get('x-garmin-relay-signature') ?? ''
  if (!/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature)) return garminResponse(403)
  if (request.headers.get('content-type') !== 'application/json') return garminResponse(415)
  if (Number(request.headers.get('content-length')) > detailsRelayMaxBytes) return garminResponse(413)
  const reader = request.body?.getReader()
  if (!reader) return garminResponse(400)
  try {
    const chunks: Uint8Array[] = []
    let size = 0
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.length
      if (size > detailsRelayMaxBytes) {
        await reader.cancel().catch(() => {})
        return garminResponse(413)
      }
      chunks.push(value)
    }
    const body = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size))
    if (!validDetailsRelaySignature(key, timestamp, body, signature)) return garminResponse(403)
    const items = JSON.parse(body)
    if (!Array.isArray(items) || !items.length || items.length > detailsRelayBatchSize ||
        !items.every(item => item && typeof item.garmin_user_id === 'string' &&
          /^[a-f0-9]{64}$/.test(item.fingerprint) && item.payload && typeof item.payload === 'object' &&
          !Object.hasOwn(item.payload, 'file'))) return garminResponse(400)
    const config = garminServiceConfiguration()
    if (!config) return garminResponse(503)
    const { error } = await config.db.rpc('enqueue_garmin_push', {
      p_feed: 'activityDetails', p_items: items,
    }).abortSignal(AbortSignal.timeout(12_000))
    if (error) console.warn('Garmin details relay queue unavailable', { batchSize: items.length })
    return garminResponse(error ? 503 : 200)
  } catch {
    return garminResponse(503)
  } finally {
    reader.releaseLock()
  }
}
