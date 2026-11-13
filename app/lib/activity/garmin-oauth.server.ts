import { createHash, randomBytes } from 'node:crypto'

/**
 * Creates the authorization redirect and the values for a short-lived,
 * single-use server-side attempt bound to the authenticated UHL user.
 */
export function createGarminAuthorization(clientId: string, redirectUri: string) {
  const callback = new URL(redirectUri)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(callback.hostname)

  if (
    !clientId.trim() || callback.username || callback.password || callback.hash ||
    (callback.protocol !== 'https:' && !(local && callback.protocol === 'http:'))
  ) {
    throw new Error('Invalid Garmin OAuth configuration')
  }

  const state = randomBytes(32).toString('base64url')
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const url = new URL('https://connect.garmin.com/oauth2Confirm')
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString()

  return { authorizationUrl: url.toString(), state, verifier }
}
