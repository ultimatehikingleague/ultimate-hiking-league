import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { europeanGarminOrigin } from './garmin-oauth.server'

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

export function garminServiceConfiguration() {
  const { GARMIN_TOKEN_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
  if (!GARMIN_TOKEN_KEY || !garminNonce.test(GARMIN_TOKEN_KEY) ||
      !NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null
  return {
    tokenKey: Buffer.from(GARMIN_TOKEN_KEY, 'base64url'),
    db: createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  }
}

export function garminConfiguration() {
  const { GARMIN_OAUTH_ENABLED, GARMIN_CLIENT_ID, GARMIN_CLIENT_SECRET, GARMIN_REDIRECT_URI,
    NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = process.env

  const service = garminServiceConfiguration()
  if (GARMIN_OAUTH_ENABLED !== 'true' || !GARMIN_CLIENT_ID || !GARMIN_CLIENT_SECRET ||
      !GARMIN_REDIRECT_URI || !service ||
      !NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY) return null

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
    ...service,
    browserOrigin: redirect.origin,
    auth: createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth }).auth,
  }
}

export async function exchangeGarminCode(
  config: { clientId: string; clientSecret: string; redirectUri: string },
  code: string,
  verifier: string,
) {
  return requestGarminTokens(config, {
    grant_type: 'authorization_code', redirect_uri: config.redirectUri, code, code_verifier: verifier,
  })
}

export class GarminInvalidGrant extends Error {}

export class GarminProviderError extends Error {
  constructor(
    readonly endpoint: 'token',
    readonly httpStatus: number,
    readonly oauthError?: string,
  ) {
    super('Garmin API request failed')
  }
}

export function refreshGarminTokens(config: { clientId: string; clientSecret: string }, refreshToken: string) {
  return requestGarminTokens(config, { grant_type: 'refresh_token', refresh_token: refreshToken })
}

async function requestGarminTokens(config: { clientId: string; clientSecret: string }, grant: Record<string, string>) {
  const response = await fetch('https://connectapi.garmin.com/di-oauth2-service/oauth/token', {
    method: 'POST',
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
    body: new URLSearchParams({
      ...grant,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  })
  if (!response.ok) {
    const payload = [400, 401].includes(response.status) ? await response.json().catch(() => null) : null
    const oauthError = ['invalid_grant', 'invalid_client', 'invalid_request', 'unauthorized_client',
      'unsupported_grant_type', 'invalid_scope'].find(value => value === payload?.error)
    if (grant.grant_type === 'refresh_token' && oauthError === 'invalid_grant') throw new GarminInvalidGrant()
    throw new GarminProviderError('token', response.status, oauthError)
  }

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

type GarminUserEndpoint = 'id' | 'permissions'
type GarminResponseFailure =
  | { kind: 'http'; httpStatus: number }
  | { kind: 'fetch' | 'json'; errorClass: string }
  | { kind: 'shape'; fields: Record<string, string | string[]> }

class GarminUserEndpointError extends Error {
  constructor(readonly endpoint: GarminUserEndpoint, readonly failure: GarminResponseFailure) {
    super('Garmin user endpoint failed')
  }
}

export class GarminIdentityError extends Error {
  constructor(readonly failures: GarminUserEndpointError[]) {
    super('Garmin identity or permissions check failed')
  }
}

function responseErrorClass(error: unknown) {
  const known = ['AbortError', 'TimeoutError', 'SyntaxError', 'TypeError', 'RangeError']
  return known.find(name => error instanceof Error && error.name === name) ?? 'UnknownError'
}

function jsonType(value: unknown) {
  if (value === undefined) return 'missing'
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

async function readGarminUserJson(endpoint: GarminUserEndpoint, options: RequestInit): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`https://apis.garmin.com/partner-gateway/rest/user/${endpoint}`, options)
  } catch (error) {
    throw new GarminUserEndpointError(endpoint, { kind: 'fetch', errorClass: responseErrorClass(error) })
  }
  if (!response.ok) throw new GarminUserEndpointError(endpoint, { kind: 'http', httpStatus: response.status })
  try {
    return await response.json()
  } catch (error) {
    throw new GarminUserEndpointError(endpoint, { kind: 'json', errorClass: responseErrorClass(error) })
  }
}

async function readGarminUserId(options: RequestInit) {
  const body = await readGarminUserJson('id', options)
  const userId: unknown = body && typeof body === 'object' && 'userId' in body ? body.userId : undefined
  if (typeof userId !== 'string' || !userId.trim() || userId.length > 256) {
    throw new GarminUserEndpointError('id', {
      kind: 'shape', fields: { body: jsonType(body), userId: jsonType(userId) },
    })
  }
  return userId
}

async function readGarminActivityPermission(options: RequestInit) {
  const body = await readGarminUserJson('permissions', options)
  const permissions: unknown = body && typeof body === 'object' && 'permissions' in body ? body.permissions : undefined
  if (!Array.isArray(permissions)) {
    throw new GarminUserEndpointError('permissions', {
      kind: 'shape', fields: { body: jsonType(body), permissions: jsonType(permissions) },
    })
  }
  // Diagnose item types on an unexpected array without changing the existing permission decision.
  const itemTypes = [...new Set(permissions.map(jsonType))].sort()
  if (itemTypes.some(type => type !== 'string')) {
    console.warn('Garmin user endpoint response shape', {
      endpoint: '/user/permissions', kind: 'shape', fields: { permissions: 'array', itemTypes },
    })
  }
  return permissions.includes('ACTIVITY_EXPORT')
}

export async function readGarminIdentity(accessToken: string) {
  const options = {
    headers: { Authorization: `Bearer ${accessToken}` },
    redirect: 'error' as const,
    cache: 'no-store' as const,
    signal: AbortSignal.timeout(8000),
  }
  const [identity, permissions] = await Promise.allSettled([
    readGarminUserId(options),
    readGarminActivityPermission(options),
  ])
  if (identity.status === 'fulfilled' && permissions.status === 'fulfilled') {
    return { userId: identity.value, canExportActivities: permissions.value }
  }
  const failures = [identity, permissions].flatMap(result =>
    result.status === 'rejected' && result.reason instanceof GarminUserEndpointError ? [result.reason] : [],
  )
  throw new GarminIdentityError(failures)
}

export function encryptGarminTokens(key: Buffer, owner: string, tokens: Awaited<ReturnType<typeof exchangeGarminCode>>) {
  return encryptGarminValue(key, owner, JSON.stringify(tokens))
}

export function encryptGarminValue(key: Buffer, aad: string, value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(aad))
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url')].join('.')
}

export async function authenticateGarmin(request: Request) {
  const config = garminConfiguration()
  if (!config) return garminResponse(404)
  const origin = request.headers.get('origin')
  if (request.method !== 'GET' &&
      (!origin || (origin !== config.browserOrigin && origin !== europeanGarminOrigin(config.browserOrigin)))) {
    return garminResponse(403)
  }
  const bearer = request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1]
  if (!bearer) return garminResponse(401)
  const { data: { user }, error } = await config.auth.getUser(bearer)
  if (error || !user) return garminResponse(401)
  return { config, owner: user.id }
}

export function decryptGarminValue(key: Buffer, aad: string, value: string) {
  const [version, iv, tag, encrypted, ...rest] = value.split('.')
  if (version !== 'v1' || !iv || !tag || !encrypted || rest.length) throw new Error('Invalid Garmin envelope')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'), { authTagLength: 16 })
  decipher.setAAD(Buffer.from(aad))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString()
}
