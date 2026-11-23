'use client'

import { useLocale, useTranslations } from 'next-intl'
import Link from '@/i18n/prototype/LocalizedLink'
import { usePathname } from 'next/navigation'
import { splitLanguagePath } from '../../i18n/public-paths'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import LanguageSwitcher from './LanguageSwitcher'

type NavItemProps = {
  href: string
  title: string
  subtitle?: string
  active?: boolean
  fixedTitle?: boolean
}

function NavItem({ href, title, subtitle, active, fixedTitle }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`group min-w-0 rounded-2xl border px-3 py-4 text-center [overflow-wrap:anywhere] transition-all duration-300 ${
        active
          ? 'border-stone-100 bg-stone-100 text-stone-950 shadow-[0_10px_30px_rgba(255,255,255,0.12)]'
          : 'border-white/10 bg-black/20 text-stone-100 backdrop-blur-sm hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/10 hover:shadow-[0_12px_30px_rgba(0,0,0,0.22)]'
      }`}
    >
      <div translate={fixedTitle ? 'no' : undefined} className={`text-balance text-sm font-semibold ${fixedTitle ? 'notranslate' : ''}`}>{title}</div>
      {subtitle && <div
        className={`mt-1 text-balance text-xs uppercase tracking-[0.12em] transition ${
          active
            ? 'text-stone-600'
            : 'text-stone-400 group-hover:text-stone-200'
        }`}
      >
        {subtitle}
      </div>}
    </Link>
  )
}

export default function Nav({ compactOnMobile = false }: { compactOnMobile?: boolean }) {
  const t = useTranslations('ui')
  const eventsLabel = t('navEventsLabel')
  const faqLabel = t('navFaqLabel')
  const locale = useLocale()
  const localizeSubtitles = locale === 'pl' || locale === 'it' || locale === 'es' || locale === 'cs'
  const currentPath = usePathname()
  const pathname = splitLanguagePath(currentPath)?.pathname ?? currentPath
  const isShop = pathname === '/shop' || pathname.startsWith('/shop/')
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    if (isShop) return
    async function loadSession() {
      const { data } = await supabase.auth.getSession()
      setIsLoggedIn(!!data.session)
    }

    void loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [isShop])

  if (isShop) return (
    <nav aria-label={t("shopNavigation")} className="flex w-full flex-wrap items-start justify-between gap-3">
      <div className="grid w-full max-w-[180px] shrink-0">
        <NavItem href="/" title={t("home")} subtitle={localizeSubtitles ? undefined : "Home"} />
      </div>
      <LanguageSwitcher className="relative ml-auto shrink-0" compact />
    </nav>
  )

  return (
    <nav className={'relative grid w-full sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 ' + (compactOnMobile
      ? 'grid-cols-2 gap-2 sm:gap-3 max-sm:[&>a]:flex max-sm:[&>a]:min-h-11 max-sm:[&>a]:items-center max-sm:[&>a]:justify-center max-sm:[&>a]:px-2 max-sm:[&>a]:py-1.5 max-sm:[&>a>div:nth-child(2)]:hidden'
      : 'gap-3')}>
      <div className="col-span-full flex justify-end">
        <LanguageSwitcher className="relative" compact={pathname !== '/'} />
      </div>
      <NavItem
        href="/"
        title={t("home")}
        subtitle={localizeSubtitles ? undefined : "Home"}
        active={pathname === '/'}
      />

      <NavItem
        href="/leaderboard"
        title={t("rankings")}
        subtitle={t("allRankings")}
        active={pathname === '/leaderboard' || pathname.startsWith('/leaderboard/')}
      />

      <NavItem
        href="/division"
        title={t("divisions")}
        subtitle="Silver · Gold · Platinum"
        active={pathname === '/division' || pathname.startsWith('/division/')}
      />

      <NavItem
        href="/rules"
        title={t("leagueRules")}
        subtitle={t("rules")}
        active={pathname === '/rules'}
      />

      <NavItem
        href="/events"
        title={eventsLabel}
        fixedTitle={eventsLabel === 'Events'}
        subtitle={t("calendar")}
        active={pathname === '/events'}
      />

      <NavItem
        href="/faq"
        title={faqLabel}
        fixedTitle={faqLabel === 'FAQ'}
        subtitle={t("questions")}
        active={pathname === '/faq'}
      />

      {isLoggedIn ? (
        <NavItem
          href="/account"
          title={t("myAccount")}
          subtitle={t("protected")}
          active={pathname === '/account'}
        />
      ) : (
        <NavItem
          href="/login"
          title={t("signInRegister")}
          subtitle={localizeSubtitles ? t("myAccount") : "Account"}
          active={pathname === '/login'}
        />
      )}

      <NavItem
        href="/search"
        title={t("search")}
        subtitle={t("profilesEvents")}
        active={pathname === '/search'}
      />
    </nav>
  )
}