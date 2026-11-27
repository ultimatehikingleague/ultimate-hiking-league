'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import MilestoneShop from './MilestoneShop'
import { authLanguageHint } from '@/i18n/auth-language'

export default function MilestoneShopPage() {
  const t = useTranslations('milestones')
  const locale = useLocale()
  const loginUrl = '/login?' + new URLSearchParams({ next: '/milestone-shop', [authLanguageHint]: locale })
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let sessionVersion = 0
    let expectedUser: string | null | undefined
    let verification: ReturnType<typeof setTimeout> | undefined

    async function verifyUser() {
      const version = sessionVersion
      const { data: { user }, error } = await supabase.auth.getUser()
      if (!active || version !== sessionVersion) return
      if (error || !user || (expectedUser !== undefined && user.id !== expectedUser)) {
        setUserId(null)
        window.location.replace(loginUrl)
        return
      }
      expectedUser = user.id
      setUserId(user.id)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return
      const nextUser = session?.user.id ?? null
      if (nextUser === expectedUser) return
      expectedUser = nextUser
      sessionVersion++
      clearTimeout(verification)
      setUserId(null)
      if (nextUser) verification = setTimeout(() => void verifyUser(), 0)
      else window.location.replace(loginUrl)
    })
    void verifyUser()

    return () => {
      active = false
      clearTimeout(verification)
      subscription.unsubscribe()
    }
  }, [loginUrl])

  if (!userId) {
    return <main className="grid min-h-screen place-items-center bg-[#04121d] text-sm text-slate-300"><p role="status">{t('checkingSignIn')}</p></main>
  }

  return <MilestoneShop key={userId} userId={userId} />
}
