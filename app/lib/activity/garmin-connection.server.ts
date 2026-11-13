import { createCipheriv, createHash, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const garminAttemptCookie = 'uhl_garmin_attempt'
export const garminAttemptSeconds = 600
export const garminNonce = /^[A-Za-z0-9_-]{43}$/

export function garminDigest(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function garminResponse(status: number) {
  return new NextResponse(null, {
    status,
    headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  })
}

export function garminConfiguration() {
  const { GARMIN_OAUTH_ENABLED, GARMIN_CLIENT_ID, GARMIN_CLIENT_SECRET, GARMIN_REDIRECT_URI,
    GARMIN_TOKEN_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY } = process.env

  if (GARMIN_OAUTH_ENABLED !== 'true' || !GARMIN_CLIENT_ID || !GARMIN_CLIENT_SECRET ||
      !GARMIN_REDIRECT_URI || !GARMIN_TOKEN_KEY || !garminNonce.test(GARMIN_TOKEN_KEY) ||
      !NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) return null

  const redirect = new URL(GARMIN_REDIRECT_URI)
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(redirect.hostname)
  if (redirect.pathname !== '/api/garmin/callback' || redirect.search || redirect.hash ||
      redirect.username || redirect.password ||
      (redirect.protocol !== 'https:' && !(loopback && redirect.protocol === 'http:'))) return null

  const auth = { persistSession: false, autoRefreshToken: false }
  return {
    clientId: GARMIN_CLIENT_ID,
    clientSecret: GARMIN_CLIENT_SECRET,
    redirectUri: GARMIN_REDIRECT_URI,
    tokenKey: Buffer.from(GARMIN_TOKEN_KEY, 'base64url'),
    browserOrigin: redirect.origin,
    cookieOptions: { path: '/api/garmin/callback', httpOnly: true, sameSite: 'lax' as const,
      secure: redirect.protocol === 'https:' },
    auth: createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth }).auth,
    db: createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth }),
  }
}

export async function exchangeGarminCode(
  config: { clientId: string; clientSecret: string; redirectUri: string },
  code: string,
  verifier: string,
) {
  const response = await fetch('https://connectapi.garmin.com/di-oauth2-service/oauth/token', {
    method: 'POST',
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code,
      code_verifier: verifier,
    }),
  })
  if (!response.ok) throw new Error('Garmin token exchange failed')

  const { access_token, refresh_token, expires_in, refresh_token_expires_in, token_type } = await response.json()
  if (typeof access_token !== 'string' || !access_token || typeof refresh_token !== 'string' ||
      !refresh_token || typeof token_type !== 'string' || token_type.toLowerCase() !== 'bearer' ||
      !Number.isSafeInteger(expires_in) || expires_in <= 0 ||
      !Number.isSafeInteger(refresh_token_expires_in) || refresh_token_expires_in <= 0) {
    throw new Error('Invalid Garmin token response')
  }

  const now = Date.now()
  return {
    accessToken: access_token as string,
    refreshToken: refresh_token as string,
    accessExpiresAt: now + expires_in * 1000,
    refreshExpiresAt: now + refresh_token_expires_in * 1000,
  }
}

export async function readGarminIdentity(accessToken: string) {
  const options = {
    headers: { Authorization: `Bearer ${accessToken}` },
    redirect: 'error' as const,
    cache: 'no-store' as const,
    signal: AbortSignal.timeout(8000),
  }
  const base = 'https://apis.garmin.com/wellness-api/rest/user'
  const [identity, permissions] = await Promise.all([
    fetch(`${base}/id`, options),
    fetch(`${base}/permissions`, options),
  ])
  if (!identity.ok || !permissions.ok) throw new Error('Garmin identity check failed')

  const { userId } = await identity.json()
  const granted: unknown = await permissions.json()
  if (typeof userId !== 'string' || !userId.trim() || userId.length > 256 || !Array.isArray(granted)) {
    throw new Error('Invalid Garmin identity or permissions')
  }
  return { userId, canExportActivities: granted.includes('ACTIVITY_EXPORT') }
}

export function encryptGarminTokens(key: Buffer, owner: string, tokens: Awaited<ReturnType<typeof exchangeGarminCode>>) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(owner))
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url')].join('.')
}
