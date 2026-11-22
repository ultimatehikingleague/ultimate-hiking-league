import { isIPv4 } from 'node:net'
import {
  detailsRelayBatchSize, detailsRelayItem, detailsRelayMaxBytes, detailsRelayPath, detailsRelaySignature,
} from '../../app/lib/activity/garmin-details-relay'
import { normalizeGarminPush } from '../../app/lib/activity/garmin-push.server'

export const garminDetailsPath = '/api/garmin/push/activityDetails'
const mebibyte = 1024 * 1024
const maxBodyBytes = 128 * mebibyte
const maxItems = 1_000

function ipv4Number(ip: string) {
  return ip.split('.').reduce((value, octet) => value * 256 + Number(octet), 0)
}

export function garminSenderCheck(config: string) {
  const ranges = config.split(',').map(range => {
    const [network, prefix, ...rest] = range.trim().split('/')
    if (!isIPv4(network) || !/^(?:[1-9]|[12][0-9]|3[0-2])$/.test(prefix) || rest.length) {
      throw new Error('Invalid Garmin sender range')
    }
    const size = 2 ** (32 - Number(prefix))
    return { size, block: Math.floor(ipv4Number(network) / size) }
  })
  return (peer: string) => {
    const ip = peer.replace(/^::ffff:/, '')
    return isIPv4(ip) && ranges.some(({ size, block }) => Math.floor(ipv4Number(ip) / size) === block)
  }
}

type Options = {
  ranges: string
  clientId: string
  relayOrigin: string
  relayKey: Buffer
  bodyMiB?: number
  send?: typeof fetch
}

export function makeDetailsReceiver({ ranges, clientId, relayOrigin, relayKey, bodyMiB = 64, send = fetch }: Options) {
  const origin = new URL(relayOrigin)
  if (origin.protocol !== 'https:' || origin.href !== origin.origin + '/' || origin.username ||
      origin.password || !clientId || relayKey.length !== 32 ||
      !Number.isInteger(bodyMiB) || bodyMiB < 1 || bodyMiB * mebibyte > maxBodyBytes) {
    throw new Error('Invalid Garmin Details configuration')
  }
  const allowed = garminSenderCheck(ranges)
  const limit = bodyMiB * mebibyte
  let busy = false

  return async (request: Request, peer: string) => {
    const reply = (status: number) => new Response(null, {
      status, headers: { 'cache-control': 'no-store', ...(status === 503 && { 'retry-after': '60' }) },
    })
    if (request.method !== 'POST' || new URL(request.url).pathname !== garminDetailsPath ||
        new URL(request.url).search) return reply(404)
    const id = request.headers.get('garmin-client-id')
    if (!allowed(peer) || (id !== null && id !== clientId)) return reply(403)
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json' ||
        ![null, 'identity'].includes(request.headers.get('content-encoding'))) return reply(415)
    if (busy) return reply(503)
    if (Number(request.headers.get('content-length')) > limit) return reply(413)
    const reader = request.body?.getReader()
    if (!reader) return reply(400)
    busy = true
    let size = 0
    try {
      const chunks: Uint8Array[] = []
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        size += value.length
        if (size > limit) {
          // The server closes refused requests after replying.
          void reader.cancel().catch(() => {})
          console.warn('Garmin details receiver limit', { limit })
          return reply(413)
        }
        chunks.push(value)
      }
      let items
      try {
        const raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size)))
        if (!Array.isArray(raw?.activityDetails) || raw.activityDetails.length > maxItems) return reply(400)
        items = normalizeGarminPush('activityDetails', raw).map(detailsRelayItem)
      } catch {
        console.warn('Garmin details receiver invalid payload', { size })
        return reply(400)
      }
      const handoffDeadline = AbortSignal.timeout(45_000)
      for (let start = 0; start < items.length; start += detailsRelayBatchSize) {
        const body = JSON.stringify(items.slice(start, start + detailsRelayBatchSize))
        if (Buffer.byteLength(body) > detailsRelayMaxBytes) return reply(503)
        const timestamp = String(Math.floor(Date.now() / 1000))
        const response = await send(new URL(detailsRelayPath, origin), {
          method: 'POST', redirect: 'error', signal: AbortSignal.any([handoffDeadline, AbortSignal.timeout(15_000)]),
          headers: { 'content-type': 'application/json', 'x-garmin-relay-time': timestamp,
            'x-garmin-relay-signature': detailsRelaySignature(relayKey, timestamp, body) },
          body,
        })
        await response.body?.cancel().catch(() => {})
        if (response.status !== 200) {
          console.warn('Garmin details receiver handoff rejected', { status: response.status, completedBatches: start / detailsRelayBatchSize })
          return reply(503)
        }
      }
      console.info('Garmin details receiver accepted', { size, activities: items.length })
      return reply(200)
    } catch {
      console.warn('Garmin details receiver interrupted', { size })
      return reply(503)
    } finally {
      reader.releaseLock()
      busy = false
    }
  }
}
