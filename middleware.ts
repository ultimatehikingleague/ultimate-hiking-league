import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  if (/^\/(?:activity-ocr|api\/(?:activity-ocr|ocr))(?:\/|$)/.test(request.nextUrl.pathname)) {
    return new NextResponse('Not Found', { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }

  // Admin pages do their own identity + admin_users check; RLS protects data.
  if (request.nextUrl.pathname.startsWith('/admin/milestone-shop')) return NextResponse.next()
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/milestone_shop_is_live`, {
      method: 'POST',
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', 'Content-Type': 'application/json' },
      body: '{}', cache: 'no-store', signal: AbortSignal.timeout(5000),
    })
    if (response.ok && await response.json() === true) return NextResponse.next()
  } catch { /* Unavailable launch status must never open the shop. */ }
  return new NextResponse('Not Found', { status: 404, headers: { 'Cache-Control': 'no-store' } })
}

export const config = {
  matcher: ['/activity-ocr/:path*', '/api/activity-ocr/:path*', '/api/ocr/:path*', '/admin/milestone-shop/:path*', '/milestone-shop/:path*', '/account/rewards/:path*'],
}
