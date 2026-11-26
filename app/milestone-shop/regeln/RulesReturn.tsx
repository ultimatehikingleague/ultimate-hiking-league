'use client'

import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import Link from '@/i18n/prototype/LocalizedLink'
import { supabase } from '../../lib/supabase'
import { useMilestoneLaunch } from '../../lib/useMilestoneLaunch'

export default function RulesReturn({ fromPreview }: { fromPreview: boolean }) {
  const t = useTranslations('milestoneRules')
  const locale = useLocale()
  const live = useMilestoneLaunch()
  const [admin, setAdmin] = useState(false)

  useEffect(() => {
    if (!fromPreview) return
    let cancelled = false

    async function checkAdmin() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) return
        const { data, error } = await supabase.from('admin_users')
          .select('user_id').eq('user_id', user.id).maybeSingle()
        if (!cancelled) setAdmin(!error && Boolean(data))
      } catch {
        if (!cancelled) setAdmin(false)
      }
    }

    void checkAdmin()
    return () => { cancelled = true }
  }, [fromPreview])

  const preview = fromPreview && admin
  const href = preview ? '/admin/milestone-shop/vorschau' : live ? '/milestone-shop' : null
  const label = preview ? t('backToPreview') : t('back')
  const logo = <Image src="/ultimate-logo-transparent-weiss.png" alt="ULTIMATE" width={72} height={64} />
  const launchDate = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2026, 11, 1)))

  return (
    <>
      {href ? <Link href={href} aria-label={label}>{logo}</Link> : logo}
      <div aria-live="polite">
        {href
          ? <Link href={href} className="milestone-button">{label}</Link>
          : <span>{t('opensOn', { date: launchDate })}</span>}
      </div>
    </>
  )
}
