import type { NextRequest } from 'next/server'
import {
  encryptGarminValue, garminConfiguration, garminDigest, garminNonce, garminResponse,
} from '../../../lib/activity/garmin-connection.server'

function returnToUhl(status: 'received' | 'retry' | 'unavailable') {
  const response = garminResponse(303)
  response.headers.set('Location', `/garmin/return?status=${status}`)
  return response
}

export async function GET(request: NextRequest) {
  let stage = 'configuration'
  try {
    const config = garminConfiguration()
    if (!config) return returnToUhl('unavailable')

    const params = request.nextUrl.searchParams
    const state = params.get('state')
    const code = params.get('code')
    const providerError = params.get('error')
    if (!state || !garminNonce.test(state) ||
        params.getAll('state').length !== 1 || params.getAll('code').length > 1 ||
        params.getAll('error').length > 1 ||
        (params.has('error') ? !providerError || params.has('code') : !code || code.length > 4096)) {
      return returnToUhl('retry')
    }

    const stateHash = garminDigest(state)
    const result = code ? { code } : { status: providerError === 'access_denied' ? 'cancelled' : 'unavailable' }
    stage = 'encrypt-callback'
    const callbackResult = encryptGarminValue(config.tokenKey, `garmin-callback:${stateHash}`, JSON.stringify(result))
    stage = 'stage-callback'
    const { data, error } = await config.db.from('garmin_oauth_attempts')
      .update({ callback_result: callbackResult })
      .eq('state_hash', stateHash)
      .gt('expires_at', new Date().toISOString()).is('callback_result', null)
      .select('state_hash').maybeSingle()
    if (error) {
      console.error('Garmin OAuth callback failed', { stage })
      return returnToUhl('unavailable')
    }
    return returnToUhl(data ? 'received' : 'retry')
  } catch {
    console.error('Garmin OAuth callback failed', { stage })
    return returnToUhl('unavailable')
  }
}
