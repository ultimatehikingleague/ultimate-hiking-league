'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentProps } from 'react'
import { isPublicLanguagePath, splitLanguagePath } from '../public-paths'
import { authLanguageHint } from '../auth-language'

export default function LocalizedLink(props: ComponentProps<typeof Link>) {
  const current = splitLanguagePath(usePathname())
  const { href } = props
  if (!current || typeof href !== 'string' || !href.startsWith('/')) return <Link {...props} />
  const pathname = href.split(/[?#]/, 1)[0]
  if (pathname === '/login' || ((current.locale === 'pl' || current.locale === 'it' || current.locale === 'es' || current.locale === 'cs') && pathname === '/shop/checkout')) {
    const login = new URL(href, 'https://uhl.invalid')
    login.searchParams.set(authLanguageHint, current.locale)
    return <Link {...props} href={login.pathname + login.search + login.hash} prefetch={false} />
  }
  if (!isPublicLanguagePath(pathname)) return <Link {...props} />
  const target = pathname === '/' ? `/${current.locale}${href.slice(1)}` : `/${current.locale}${href}`
  return <Link {...props} href={target} />
}
