import { randomBytes } from 'node:crypto'
import {
  authenticateGarmin, garminAttemptSeconds, garminDigest, garminResponse,
} from '../../../lib/activity/garmin-connection.server'
import { createGarminAuthorization } from '../../../lib/activity/garmin-oauth.server'

export async function POST(request: Request) {
  try {
    const access = await authenticateGarmin(request)
    if (access instanceof Response) return access
    const { config, owner } = access

    const { data: connection, error: connectionError } = await config.db.from('garmin_connections')
      .select('user_id').eq('user_id', owner).maybeSingle()
    if (connectionError) return garminResponse(503)
    if (connection) return garminResponse(409)

    const now = new Date()
    const expiresAt = now.getTime() + garminAttemptSeconds * 1000
    const { error: cleanupError } = await config.db.from('garmin_oauth_attempts')
      .delete().lt('expires_at', now.toISOString())
    if (cleanupError) return garminResponse(503)

    const { authorizationUrl, state, verifier } = createGarminAuthorization(config.clientId, config.redirectUri)
    const browserProof = randomBytes(32).toString('base64url')
    const { error } = await config.db.from('garmin_oauth_attempts').insert({
      state_hash: garminDigest(state),
      browser_hash: garminDigest(browserProof),
      user_id: owner,
      verifier,
      expires_at: new Date(expiresAt).toISOString(),
    })
    if (error) return garminResponse(503)

    const response = garminResponse(200)
    response.headers.set('X-Garmin-Authorization-URL', authorizationUrl)
    response.headers.set('X-Garmin-Attempt-Proof', browserProof)
    response.headers.set('X-Garmin-Attempt-Expires-At', String(expiresAt))
    return response
  } catch {
    return garminResponse(503)
  }
}
