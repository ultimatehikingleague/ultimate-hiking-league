import { NextResponse } from 'next/server'
import {
  authenticateGarmin, decryptGarminValue, encryptGarminTokens, exchangeGarminCode,
  garminDigest, GarminIdentityError, garminNonce, GarminProviderError, garminResponse, readGarminIdentity,
} from '../../../lib/activity/garmin-connection.server'

type FinishStatus = 'waiting' | 'cancelled' | 'unavailable' | 'permission-required' | 'already-linked' | 'connected'

function result(status: FinishStatus) {
  return NextResponse.json({ status }, { headers: garminResponse(200).headers })
}

export async function POST(request: Request) {
  let stage = 'authenticate'
  try {
    const access = await authenticateGarmin(request)
    if (access instanceof Response) return access
    const { config, owner } = access
    const proof = request.headers.get('x-garmin-attempt-proof')
    if (!proof || !garminNonce.test(proof)) return garminResponse(400)

    // Claim a staged result once, before contacting Garmin. An early finish
    // request leaves the attempt available for the callback.
    stage = 'claim'
    const { data: attempt, error } = await config.db.from('garmin_oauth_attempts')
      .delete().eq('browser_hash', garminDigest(proof)).eq('user_id', owner)
      .gt('expires_at', new Date().toISOString()).not('callback_result', 'is', null)
      .select('state_hash, verifier, callback_result').maybeSingle()
    if (error) {
      console.error('Garmin OAuth finish failed', { stage })
      return garminResponse(503)
    }
    if (!attempt) return result('waiting')

    try {
      stage = 'decrypt-callback'
      const { code, status } = JSON.parse(decryptGarminValue(
        config.tokenKey, `garmin-callback:${attempt.state_hash}`, attempt.callback_result,
      ))
      if (!code) {
        if (status === 'cancelled') return result('cancelled')
        console.error('Garmin OAuth finish failed', { stage: 'provider-callback' })
        return result('unavailable')
      }

      stage = 'token'
      const tokens = await exchangeGarminCode(config, code, attempt.verifier)
      stage = 'identity-or-permissions'
      const identity = await readGarminIdentity(tokens.accessToken)
      if (!identity.canExportActivities) return result('permission-required')
      stage = 'save-connection'
      const { error: saveError } = await config.db.from('garmin_connections').insert({
        user_id: owner,
        garmin_user_id: identity.userId,
        encrypted_tokens: encryptGarminTokens(config.tokenKey, owner, tokens),
        connected_at: new Date().toISOString(),
      })
      if (saveError?.code === '23505') return result('already-linked')
      if (saveError) {
        console.error('Garmin OAuth finish failed', { stage })
        return result('unavailable')
      }
      return result('connected')
    } catch (error) {
      // Upstream errors and payloads may contain credentials or personal data.
      if (error instanceof GarminIdentityError && error.failures.length) {
        for (const { endpoint, failure } of error.failures) {
          console.error('Garmin OAuth finish failed', { stage, endpoint: `/user/${endpoint}`, ...failure })
        }
        return result('unavailable')
      }
      console.error('Garmin OAuth finish failed', error instanceof GarminProviderError
        ? { stage, endpoint: error.endpoint, httpStatus: error.httpStatus,
            ...(error.oauthError && { oauthError: error.oauthError }) }
        : { stage })
      return result('unavailable')
    }
  } catch {
    console.error('Garmin OAuth finish failed', { stage })
    return garminResponse(503)
  }
}
