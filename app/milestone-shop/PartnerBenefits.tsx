'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import PartnerBenefitCards from './PartnerBenefitCards'
import type { PartnerBenefit } from './PartnerBenefitCards'

export const partnerBenefitColumns = 'id,title,description,partner_name,reward_type,image_url,is_active,redemption_url,redemption_instructions,shared_code'

export function isPartnerBenefit(type: string) {
  return type === 'benefit' || type === 'affiliate'
}

export default function PartnerBenefits({ preview = false }: { preview?: boolean }) {
  const t = useTranslations('partnerBenefits')
  const [benefits, setBenefits] = useState<PartnerBenefit[]>([])
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const query = supabase.from('milestone_partner_benefits').select(partnerBenefitColumns).order('id')
      const { data, error } = await (preview ? query : query.eq('is_active', true))
      if (!cancelled) {
        setError(!!error)
        setBenefits((data ?? []) as PartnerBenefit[])
      }
    }
    void load()
    return () => { cancelled = true }
  }, [preview])

  if (error) return <p role="alert" className="mx-auto my-8 max-w-7xl px-5 text-slate-300">{t('loadError')}</p>
  if (!benefits.length) return null

  return <PartnerBenefitCards benefits={benefits} preview={preview} />
}
