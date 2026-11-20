import { timingSafeEqual } from 'node:crypto'
import { decryptGarminValue, garminResponse, garminServiceConfiguration } from '../../../lib/activity/garmin-connection.server'
import { fileCallback } from '../../../lib/activity/garmin-push.server'
import { parseActivity } from '../../../lib/activity/parse'

export const maxDuration = 60
const fileLimit = 32 * 1024 * 1024
const downloadAttemptLimit = 3

type WorkerError = { status?: unknown; statusCode?: unknown; code?: unknown }

function missingObject(error: WorkerError | null) {
  return (error?.status === 400 || error?.status === 404)
    && (error.code ?? error.statusCode) === 'NoSuchKey'
}

const loggedCodes = new Set([
  'NoSuchKey', 'NoSuchBucket', 'TenantNotFound', 'InvalidJWT', 'AccessDenied',
  'InvalidRequest', 'InvalidKey', 'InvalidBucketName', 'InternalError',
  'DatabaseError', 'DatabaseTimeout', 'ResourceAlreadyExists', 'KeyAlreadyExists',
  'download-gone', 'download-rejected', 'download-failed', 'file-too-large', 'invalid-activity-file',
])

async function fileBytes(response: Response) {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('missing-file')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const part = await reader.read()
      if (part.done) break
      size += part.value.length
      if (size > fileLimit) {
        await reader.cancel()
        throw new Error('file-too-large')
      }
      chunks.push(part.value)
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks, size)
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const actual = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return garminResponse(401)

  let phase = 'configuration'
  let jobId: number | null = null
  let attempt: number | null = null

  function logFailure(error?: WorkerError) {
    const code = error?.code ?? error?.statusCode
    console.warn('Garmin worker failure', {
      phase, jobId, attempt,
      status: typeof error?.status === 'number' ? error.status : null,
      code: typeof code === 'string' && loggedCodes.has(code) ? code : null,
    })
  }

  function unavailable(error?: WorkerError) {
    logFailure(error)
    return garminResponse(503)
  }

  try {
    if (process.env.GARMIN_WORKER_ENABLED !== 'true') return garminResponse(404)
    const config = garminServiceConfiguration()
    if (!config) return unavailable()
    phase = 'cleanup-list'
    const { data: expired, error: cleanupError } = await config.db.rpc('list_garmin_files_for_cleanup')
      .abortSignal(AbortSignal.timeout(5000))
    if (cleanupError || !Array.isArray(expired)) return unavailable(cleanupError ?? undefined)
    if (expired.length) {
      phase = 'cleanup-remove'
      const { error } = await config.db.storage.from('garmin-activity-files').remove(expired.map(file => file.name))
      if (error) return unavailable(error)
    }
    const exportAllowed = async (owner: string) => {
      phase = 'export-permission'
      const { data, error } = await config.db.from('garmin_connections').select('user_id')
        .eq('user_id', owner).is('activity_export_revoked_at', null)
        .abortSignal(AbortSignal.timeout(5000)).maybeSingle()
      if (error) throw error
      return Boolean(data)
    }
    const deadline = Date.now() + 35_000
    for (let index = 0; index < 20 && Date.now() < deadline; index++) {
      jobId = attempt = null
      phase = 'claim'
      const { data: job, error } = await config.db.rpc('claim_garmin_push').abortSignal(AbortSignal.timeout(5000)).maybeSingle<{
        id: number; attempts: number; owner_id: string; feed: string; fingerprint: string
        payload: Record<string, unknown> & { activityId?: string; file?: { format: string; encryptedUrl: string } }
      }>()
      if (error) return unavailable(error)
      if (!job) break
      jobId = job.id
      attempt = job.attempts
      // The inbox persists the private evidence independently of the FIT import.
      const { file, ...metrics } = job.payload
      delete metrics.privateEvidence
      let failure = !metrics.activityId ? 'missing-activity-id' : null
      if (file && !failure && metrics.supportedType === false && metrics.type) failure = 'unsupported-activity-type'
      let url: string | null = null
      if (file && !failure) {
        try {
          url = fileCallback(decryptGarminValue(config.tokenKey, `garmin-file:${job.fingerprint}`, file.encryptedUrl))
        } catch {
          // The encrypted callback cannot be retried with the current key.
        }
        if (!url || !['FIT', 'GPX', 'TCX'].includes(file.format)) failure = 'invalid-file-callback'
      }
      if (file && url && !failure) {
        if (!await exportAllowed(job.owner_id)) continue
        const bucket = config.db.storage.from('garmin-activity-files')
        const path = `${job.owner_id}/${job.id}-${job.fingerprint}.${file.format.toLowerCase()}`
        phase = 'storage-download'
        const previous = await bucket.download(path)
        let bytes: Uint8Array | undefined
        if (previous.data) {
          bytes = new Uint8Array(await previous.data.arrayBuffer())
        } else {
          if (!missingObject(previous.error)) return unavailable(previous.error ?? undefined)
          // Confirm absence before fetching or writing the original.
          phase = 'storage-info'
          const { error: infoError } = await bucket.info(path)
          if (!missingObject(infoError)) return unavailable(infoError ?? undefined)
          if (!await exportAllowed(job.owner_id)) continue
          phase = 'garmin-download'
          let status: number | undefined
          try {
            const response = await fetch(url, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15_000) })
            status = response.status
            if (response.ok) {
              bytes = await fileBytes(response)
            } else {
              failure = status === 410 ? 'download-gone'
                : status >= 400 && status < 500 && status !== 408 && status !== 429 ? 'download-rejected'
                  : 'download-failed'
            }
          } catch (error) {
            failure = error instanceof Error && error.message === 'file-too-large' ? 'file-too-large' : 'download-failed'
          }
          if (failure) {
            logFailure({ status, code: failure })
            // Keep the existing lease for transient failures and process the next job.
            if (failure === 'download-failed' && job.attempts < downloadAttemptLimit) continue
          }
          if (bytes) {
            if (!await exportAllowed(job.owner_id)) continue
            phase = 'storage-upload'
            const { error: uploadError } = await bucket.upload(path, bytes, { contentType: 'application/octet-stream', upsert: false })
            if (uploadError) return unavailable(uploadError)
          }
        }
        if (bytes) {
          if (!await exportAllowed(job.owner_id)) continue
          try {
            const parsed = parseActivity(bytes, path, fileLimit)
            metrics.elapsedSeconds = parsed.elapsedSeconds
            metrics.fitVerified = parsed.garminElapsedSeconds !== null
            metrics.fitElapsedSeconds = parsed.garminElapsedSeconds
            metrics.fitStartTime = parsed.start ? Date.parse(parsed.start) / 1000 : null
            metrics.distanceKm = parsed.distanceKm
            metrics.ascent = parsed.ascent
            metrics.warnings = parsed.warnings
            if (parsed.start && metrics.startTimeInSeconds == null) metrics.startTimeInSeconds = Date.parse(parsed.start) / 1000
          } catch {
            failure = 'invalid-activity-file'
            phase = 'activity-parse'
            logFailure({ code: failure })
          }
        }
      }
      phase = 'finish'
      const { error: finishError } = await config.db.rpc('finish_garmin_push', {
        p_id: job.id, p_attempt: job.attempts, p_activity_id: metrics.activityId ?? null,
        p_metrics: Object.fromEntries(Object.entries(metrics).filter(([, value]) => value !== null)),
        p_failure: failure,
      }).abortSignal(AbortSignal.timeout(5000))
      if (finishError) return unavailable(finishError)
    }
    return garminResponse(200)
  } catch (error) {
    return unavailable(error && typeof error === 'object' ? error : undefined)
  }
}
