import type { NextRequest } from 'next/server'
import {
  encryptGarminTokens, exchangeGarminCode, garminAttemptCookie, garminConfiguration,
  garminDigest, garminNonce, garminResponse, readGarminIdentity,
} from '../../../lib/activity/garmin-connection.server'

export async function GET(request: NextRequest) {
  try {
    const config = garminConfiguration()
    if (!config) return garminResponse(404)

    const params = request.nextUrl.searchParams
    const state = params.get('state')
    const nonce = request.cookies.get(garminAttemptCookie)?.value
    const code = params.get('code')
    const denied = params.get('error') === 'access_denied'
    if (!state || !garminNonce.test(state) || !nonce || !garminNonce.test(nonce) ||
        params.getAll('state').length !== 1 || params.getAll('code').length > 1 ||
        params.getAll('error').length > 1 ||
        (denied ? params.has('code') : !code || code.length > 4096 || params.has('error'))) {
      return garminResponse(400)
    }

    const { data: attempt, error } = await config.db.from('garmin_oauth_attempts')
      .delete().eq('state_hash', garminDigest(state)).eq('browser_hash', garminDigest(nonce))
      .gt('expires_at', new Date().toISOString()).select('user_id, verifier').maybeSingle()
    if (error) return garminResponse(503)
    if (!attempt) return garminResponse(400)

    let status = denied ? 'cancelled' : 'unavailable'
    if (code) {
      try {
        const tokens = await exchangeGarminCode(config, code, attempt.verifier)
        const identity = await readGarminIdentity(tokens.accessToken)
        if (!identity.canExportActivities) {
          status = 'permission-required'
        } else {
          const { error: saveError } = await config.db.from('garmin_connections').insert({
            user_id: attempt.user_id,
            garmin_user_id: identity.userId,
            encrypted_tokens: encryptGarminTokens(config.tokenKey, attempt.user_id, tokens),
            connected_at: new Date().toISOString(),
          })
          status = saveError?.code === '23505' ? 'already-linked' : saveError ? 'unavailable' : 'connected'
        }
      } catch {
        // Provider responses, codes and tokens must stay out of browser messages and application logs.
      }
    }

    const response = garminResponse(303)
    response.headers.set('Location', new URL(`/account?garmin=${status}`, config.browserOrigin).toString())
    response.cookies.set(garminAttemptCookie, '', { ...config.cookieOptions, maxAge: 0 })
    return response
  } catch {
    return garminResponse(503)
  }
}
