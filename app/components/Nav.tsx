'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type NavItemProps = {
  href: string
  title: string
  subtitle: string
  active?: boolean
}

function NavItem({ href, title, subtitle, active }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`group rounded-2xl border px-5 py-4 text-center transition-all duration-300 ${
        active
          ? 'border-stone-100 bg-stone-100 text-stone-950 shadow-[0_10px_30px_rgba(255,255,255,0.12)]'
          : 'border-white/10 bg-black/20 text-stone-100 backdrop-blur-sm hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/10 hover:shadow-[0_12px_30px_rgba(0,0,0,0.22)]'
      }`}
    >
      <div className="text-sm font-semibold">{title}</div>
      <div
        className={`mt-1 text-xs uppercase tracking-[0.18em] transition ${
          active
            ? 'text-stone-600'
            : 'text-stone-400 group-hover:text-stone-200'
        }`}
      >
        {subtitle}
      </div>
    </Link>
  )
}

export default function Nav() {
  const pathname = usePathname()
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
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
  }, [])

  return (
    <nav className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
      <NavItem
        href="/"
        title="Startseite"
        subtitle="Home"
        active={pathname === '/'}
      />

      <NavItem
        href="/leaderboard"
        title="Ranglisten"
        subtitle="Alle Rankings"
        active={pathname === '/leaderboard' || pathname.startsWith('/leaderboard/')}
      />

      <NavItem
        href="/division"
        title="Divisionen"
        subtitle="Silver · Gold · Platinum"
        active={pathname === '/division' || pathname.startsWith('/division/')}
      />

      <NavItem
        href="/rules"
        title="Ligaregeln"
        subtitle="Regelwerk"
        active={pathname === '/rules'}
      />

      <NavItem
        href="/events"
        title="Events"
        subtitle="Kalender"
        active={pathname === '/events'}
      />

      <NavItem
        href="/faq"
        title="FAQ"
        subtitle="Fragen & Antworten"
        active={pathname === '/faq'}
      />

      {isLoggedIn ? (
        <NavItem
          href="/account"
          title="Mein Account"
          subtitle="Geschützt"
          active={pathname === '/account'}
        />
      ) : (
        <NavItem
          href="/login"
          title="Einloggen / Registrieren"
          subtitle="Account"
          active={pathname === '/login'}
        />
      )}

      <NavItem
        href="/search"
        title="Suche"
        subtitle="Profile & Events"
        active={pathname === '/search'}
      />
    </nav>
  )
}