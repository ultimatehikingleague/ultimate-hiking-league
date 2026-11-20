'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

export type PartnerBenefit = {
  id: number
  title: string
  description: string | null
  partner_name: string
  reward_type: 'benefit' | 'affiliate'
  image_url: string | null
  is_active: boolean
  redemption_url: string
  redemption_instructions: string | null
  shared_code: string | null
}

function PartnerBenefitCard({ benefit, preview }: { benefit: PartnerBenefit; preview: boolean }) {
  const t = useTranslations('partnerBenefits')
  const [copyStatus, setCopyStatus] = useState('')
  const code = benefit.shared_code
  const affiliate = benefit.reward_type === 'affiliate'

  async function copyCode() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopyStatus('Kopiert')
    } catch {
      setCopyStatus('Bitte Code markieren und kopieren.')
    }
  }

  return (
    <article className="flex h-full flex-col rounded-3xl border border-cyan-300/15 bg-[#141d28] p-6">
      <div className="flex items-center gap-3">
        {benefit.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={benefit.image_url} alt="" loading="lazy" className="h-12 w-16 shrink-0 object-contain" />
        )}
        <p className="font-semibold text-slate-200">{benefit.partner_name}</p>
      </div>
      <h3 className="mt-5 text-2xl font-bold leading-tight text-cyan-200">{benefit.title}</h3>
      {benefit.description && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-300">{benefit.description}</p>}
      <div className="mt-auto pt-5">
        {code && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-cyan-300/30 bg-[#0b141e] p-3">
            <div className="min-w-0">
              <p className="text-xs text-slate-300">{t('code')}</p>
              <code className="break-all text-base font-bold tracking-wide text-white">{code}</code>
            </div>
            <button type="button" onClick={() => void copyCode()} className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:border-cyan-300">
              {t('copy')}
            </button>
            <span role="status" className="w-full text-xs text-cyan-200 empty:hidden">{copyStatus}</span>
          </div>
        )}
        <p className="mb-3 text-sm leading-5 text-slate-300">
          {code ? t('useCode') : t('followLink')}
        </p>
        {benefit.redemption_instructions && <p className="mb-3 whitespace-pre-line text-xs leading-5 text-slate-300">{benefit.redemption_instructions}</p>}
        {affiliate && <p className="mb-3 text-xs leading-5 text-slate-300">{t('disclosure')}</p>}
        {preview ? (
          <>
            <button type="button" disabled className="w-full rounded-xl bg-cyan-300/20 px-4 py-3 font-bold text-cyan-100">{t('view')}</button>
            <p className="mt-2 text-xs text-amber-200">{benefit.is_active ? t('active') : t('draft')}</p>
          </>
        ) : (
          <a href={benefit.redemption_url} target="_blank" rel={affiliate ? 'sponsored noopener noreferrer' : 'noopener noreferrer'} className="block rounded-xl bg-cyan-300 px-4 py-3 text-center font-bold text-slate-950 hover:bg-cyan-200">
            {t('to')} {benefit.partner_name}
          </a>
        )}
      </div>
    </article>
  )
}

export default function PartnerBenefitCards({ benefits, preview = false }: { benefits: PartnerBenefit[]; preview?: boolean }) {
  const t = useTranslations('partnerBenefits')
  return (
    <section id="partnervorteile" aria-labelledby="partnervorteile-titel" className="mx-auto max-w-7xl scroll-mt-8 px-5 pb-16 md:px-10">
      <div className="rounded-3xl border border-cyan-300/20 bg-[#0d1924] p-6 md:p-9">
        <h2 id="partnervorteile-titel" className="text-3xl font-bold text-white md:text-4xl">{t('title')}</h2>
        <p className="mt-3 text-slate-300">{t('intro')}</p>
        <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {benefits.map(benefit => <PartnerBenefitCard key={benefit.id} benefit={benefit} preview={preview} />)}
        </div>
      </div>
    </section>
  )
}
