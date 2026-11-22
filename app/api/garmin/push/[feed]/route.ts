import { createCipheriv, randomBytes } from 'node:crypto'
import { isIPv4 } from 'node:net'
import { garminConfiguration, garminDigest, garminResponse } from '../../../../lib/activity/garmin-connection.server'
import { garminActivityFeeds, normalizeGarminPush, type GarminActivityFeed } from '../../../../lib/activity/garmin-push.server'
import { normalizeGarminCommonPush } from '../../../../lib/activity/garmin-permissions.server'

const maxPushBytes = 4 * 1024 * 1024
// Confirmed at the production Vercel ingress. Leave room below its limit.
const maxDetailsBytes = 4_400_000

class PushBodyTooLarge extends Error {}

function ipv4Number(ip: string) {
  return ip.split('.').reduce((value, octet) => value * 256 + Number(octet), 0)
}

function permittedOrigin(request: Request) {
  const ip = request.headers.get('x-vercel-forwarded-for')
  const ranges = process.env.GARMIN_PUSH_IP_RANGES?.split(',').map(value => value.trim())
  if (!ip || !isIPv4(ip) || !ranges?.length) return false

  return ranges.some(range => {
    const [network, prefix, ...rest] = range.split('/')
    if (!isIPv4(network) || !/^(?:[1-9]|[12][0-9]|3[0-2])$/.test(prefix) || rest.length) return false
    const size = 2 ** (32 - Number(prefix))
    return Math.floor(ipv4Number(ip) / size) === Math.floor(ipv4Number(network) / size)
  })
}

async function readPayload(request: Request, maxBytes = maxPushBytes) {
  const declaredBytes = request.headers.get('content-length')
  if (declaredBytes !== null && Number(declaredBytes) > maxBytes) throw new PushBodyTooLarge()
  const reader = request.body?.getReader()
  if (!reader) throw new Error('Missing push body')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.length
      if (size > maxBytes) {
        await reader.cancel().catch(() => {})
        throw new PushBodyTooLarge()
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size))) as unknown
}

export async function POST(request: Request, { params }: { params: Promise<{ feed: string }> }) {
  const { feed } = await params
  const common = feed === 'deregistrations' || feed === 'userPermissionsChange'
  if ((!common && !garminActivityFeeds.includes(feed as GarminActivityFeed)) ||
      process.env.GARMIN_PUSH_ENABLED !== 'true' || process.env.VERCEL !== '1') return garminResponse(404)

  let stage = 'configuration'
  try {
    const config = garminConfiguration()
    if (!config) return garminResponse(404)
    if (!permittedOrigin(request)) return garminResponse(403)
    const clientId = request.headers.get('garmin-client-id')
    if (clientId !== null && clientId !== config.clientId) return garminResponse(403)
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return garminResponse(415)
    }

    if (common) {
      let items
      try {
        items = normalizeGarminCommonPush(feed, await readPayload(request))
      } catch (error) {
        const status = error instanceof PushBodyTooLarge ? 413 : 400
        console.warn('Garmin COMMON delivery rejected', { feed, status })
        return garminResponse(status)
      }

      stage = 'persist'
      const { data, error } = await config.db.rpc('apply_garmin_common_push', {
        p_feed: feed,
        p_items: items,
      }).abortSignal(AbortSignal.timeout(12_000))
      if (error || typeof data !== 'number') {
        console.error('Garmin COMMON delivery failed', { feed, stage })
        return garminResponse(503)
      }
      console.info('Garmin COMMON delivery acknowledged', { feed, received: items.length, applied: data })
      return garminResponse(200)
    }

    let items
    try {
      items = normalizeGarminPush(feed as GarminActivityFeed, await readPayload(
        request, feed === 'activityDetails' ? maxDetailsBytes : maxPushBytes,
      ))
    } catch (error) {
      if (error instanceof PushBodyTooLarge) {
        console.warn('Garmin push rejected by UHL body limit', { feed })
        return garminResponse(413)
      }
      return garminResponse(400)
    }

    const { error } = await config.db.rpc('enqueue_garmin_push', {
      p_feed: feed,
      p_items: items.map(({ userId, file, ...payload }) => {
        const fingerprint = garminDigest(JSON.stringify({ ...payload, file }))
        if (!file?.callbackUrl) return { garmin_user_id: userId, fingerprint, payload }

        const iv = randomBytes(12)
        const cipher = createCipheriv('aes-256-gcm', config.tokenKey, iv)
        cipher.setAAD(Buffer.from(`garmin-file:${fingerprint}`))
        const encrypted = Buffer.concat([cipher.update(file.callbackUrl, 'utf8'), cipher.final()])
        const encryptedUrl = ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'),
          encrypted.toString('base64url')].join('.')
        return { garmin_user_id: userId, fingerprint, payload: { ...payload, file: { format: file.format, encryptedUrl } } }
      }),
    }).abortSignal(AbortSignal.timeout(12_000))
    return garminResponse(error ? 503 : 200)
  } catch {
    if (common) console.error('Garmin COMMON delivery failed', { feed, stage })
    return garminResponse(503)
  }
}
