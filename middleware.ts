import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { authLanguageCookie, authLanguageHint } from './i18n/auth-language'
import { isLocale } from './i18n/locales'

function preserveLanguageHint(request: NextRequest) {
  const url = request.nextUrl.clone()
  const hints = url.searchParams.getAll(authLanguageHint)
  if (!hints.length) return NextResponse.next()

  url.searchParams.delete(authLanguageHint)
  const response = NextResponse.redirect(url, {
    status: 307,
    headers: { 'Cache-Control': 'private, no-store' },
  })
  if (hints.length === 1 && isLocale(hints[0]) &&
      (url.pathname !== '/shop/checkout' || hints[0] === 'pl' || hints[0] === 'it' || hints[0] === 'es' || hints[0] === 'cs')) {
    response.cookies.set(authLanguageCookie, hints[0], {
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
    })
  }
  return response
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/shop/checkout') {
    return preserveLanguageHint(request)
  }

  if (/^\/(?:activity-ocr|api\/(?:activity-ocr|ocr))(?:\/|$)/.test(request.nextUrl.pathname)) {
    return new NextResponse('Not Found', { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }

  // The rules and calculator are informational, including before the shop launch.
  if (request.nextUrl.pathname === '/milestone-shop/regeln') return NextResponse.next()

  // Admin pages do their own identity + admin_users check; RLS protects data.
  if (request.nextUrl.pathname.startsWith('/admin/milestone-shop')) return NextResponse.next()
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/milestone_shop_is_live`, {
      method: 'POST',
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', 'Content-Type': 'application/json' },
      body: '{}', cache: 'no-store', signal: AbortSignal.timeout(5000),
    })
    if (response.ok && await response.json() === true) {
      return request.nextUrl.pathname === '/milestone-shop' ? preserveLanguageHint(request) : NextResponse.next()
    }
  } catch { /* Unavailable launch status must never open the shop. */ }
  return new NextResponse('Not Found', { status: 404, headers: { 'Cache-Control': 'no-store' } })
}

export const config = {
  matcher: ['/login', '/shop/checkout', '/activity-ocr/:path*', '/api/activity-ocr/:path*', '/api/ocr/:path*', '/admin/milestone-shop/:path*', '/milestone-shop/:path*', '/account/rewards/:path*'],
}
