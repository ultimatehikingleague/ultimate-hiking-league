'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import MilestoneShop from './MilestoneShop'

export default function MilestoneShopPage() {
  const t = useTranslations('milestones')
  const router = useRouter()
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
        router.replace('/login')
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
      else router.replace('/login')
    })
    void verifyUser()

    return () => {
      active = false
      clearTimeout(verification)
      subscription.unsubscribe()
    }
  }, [router])

  if (!userId) {
    return <main className="grid min-h-screen place-items-center bg-[#04121d] text-sm text-slate-300"><p role="status">{t('checkingSignIn')}</p></main>
  }

  return <MilestoneShop key={userId} userId={userId} />
}
