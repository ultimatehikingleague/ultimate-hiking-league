import { randomBytes } from 'node:crypto'
import {
  garminAttemptCookie, garminAttemptSeconds, garminConfiguration, garminDigest, garminResponse,
} from '../../../lib/activity/garmin-connection.server'
import { createGarminAuthorization } from '../../../lib/activity/garmin-oauth.server'

export async function POST(request: Request) {
  try {
    const config = garminConfiguration()
    if (!config) return garminResponse(404)
    if (request.headers.get('origin') !== config.browserOrigin) return garminResponse(403)

    const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1]
    if (!token) return garminResponse(401)
    const { data: { user }, error: authError } = await config.auth.getUser(token)
    if (authError || !user) return garminResponse(401)

    const { data: connection, error: connectionError } = await config.db.from('garmin_connections')
      .select('user_id').eq('user_id', user.id).maybeSingle()
    if (connectionError) return garminResponse(503)
    if (connection) return garminResponse(409)

    const now = new Date()
    const { error: cleanupError } = await config.db.from('garmin_oauth_attempts')
      .delete().lt('expires_at', now.toISOString())
    if (cleanupError) return garminResponse(503)

    const { authorizationUrl, state, verifier } = createGarminAuthorization(config.clientId, config.redirectUri)
    const browserNonce = randomBytes(32).toString('base64url')
    const { error } = await config.db.from('garmin_oauth_attempts').insert({
      state_hash: garminDigest(state),
      browser_hash: garminDigest(browserNonce),
      user_id: user.id,
      verifier,
      expires_at: new Date(now.getTime() + garminAttemptSeconds * 1000).toISOString(),
    })
    if (error) return garminResponse(503)

    const response = garminResponse(200)
    response.headers.set('X-Garmin-Authorization-URL', authorizationUrl)
    response.cookies.set(garminAttemptCookie, browserNonce, { ...config.cookieOptions, maxAge: garminAttemptSeconds })
    return response
  } catch {
    return garminResponse(503)
  }
}
