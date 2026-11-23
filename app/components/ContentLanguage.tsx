'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { splitLanguagePath } from '../../i18n/public-paths'
import { useLocale } from 'next-intl'
import LanguageSwitcher from './LanguageSwitcher'

const translated = new Set([
  '/', '/search', '/skyscraper', '/kontakt', '/logout', '/cookie-einstellungen', '/shop',
  '/shop/checkout', '/shop/bestellung', '/shop/schorschys-wanderkalender-2027', '/milestone-shop', '/rules', '/faq', '/events', '/login', '/reset-password', '/leaderboard', '/leaderboard/overall', '/leaderboard/country',
  '/milestone-shop/regeln', '/datenschutz', '/impressum', '/disclaimer',
  '/shop/bestellinformationen', '/shop/widerruf', '/shop/widerruf/erklaeren',
  '/account', '/account/calendar', '/account/rewards', '/garmin/return',
  '/division', '/division/silver', '/division/gold', '/division/platinum',
])

export default function ContentLanguage({ children }: { children: ReactNode }) {
  const currentPath = usePathname()
  const pathname = splitLanguagePath(currentPath)?.pathname ?? currentPath
  const locale = useLocale()
  const hasOwnNavigation = pathname === '/' || pathname === '/shop' || pathname === '/shop/schorschys-wanderkalender-2027'
  return <>
    {!hasOwnNavigation && <header className="mx-auto flex w-full max-w-7xl justify-end px-4 pt-3 md:px-6">
      <LanguageSwitcher compact />
    </header>}
    <main className="flex-1" lang={translated.has(pathname) || /^\/(events|challenges)\//.test(pathname) || /^\/\d+$/.test(pathname) ? locale : 'de'}>{children}</main>
  </>
}
