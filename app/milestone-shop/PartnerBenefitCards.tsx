'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import OfferArtwork from './OfferArtwork'
import OfferText, { externalOfferUrl } from './OfferText'
import './offer-cards.css'

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
  const url = externalOfferUrl(benefit.redemption_url)

  async function copyCode() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopyStatus(t('copied'))
    } catch {
      setCopyStatus(t('copyError'))
    }
  }

  return (
    <article className="milestone-card">
      <OfferArtwork id={benefit.id} image={benefit.image_url} variant="free" label={t('free')} />
      <div className="milestone-card-body">
        <p className="milestone-partner">{benefit.partner_name}</p>
        <h3>{benefit.title}</h3>
        {benefit.description && <p className="mt-2 whitespace-pre-line text-sm text-slate-200"><OfferText text={benefit.description} linkify={!preview} /></p>}
        <details className="mt-3 text-sm text-slate-200">
          <summary className="cursor-pointer font-semibold text-cyan-200">{t('details')}</summary>
          <p className="mt-2">{code ? t('useCode') : t('followLink')}</p>
          {benefit.redemption_instructions && <p className="mt-2 whitespace-pre-line"><OfferText text={benefit.redemption_instructions} linkify={!preview} /></p>}
        </details>
        <div className="milestone-card-footer">
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
        {affiliate && <p className="mb-3 text-xs leading-5 text-slate-300">{t('disclosure')}</p>}
        {preview ? (
          <>
            <button type="button" disabled className="milestone-button w-full">{t('view')}</button>
            <p className="mt-2 text-xs text-amber-200">{benefit.is_active ? t('active') : t('draft')}</p>
          </>
        ) : url && (
          <a href={url} target="_blank" rel={affiliate ? 'sponsored noopener noreferrer' : 'noopener noreferrer'} className="milestone-button w-full">
            {t('view')} <span aria-hidden="true">↗</span>
          </a>
        )}
        </div>
      </div>
    </article>
  )
}

export default function PartnerBenefitCards({ benefits, preview = false }: { benefits: PartnerBenefit[]; preview?: boolean }) {
  const t = useTranslations('partnerBenefits')
  return (
    <section id="partnervorteile" aria-labelledby="partnervorteile-titel" className="milestone-benefits">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="partnervorteile-titel" className="text-2xl font-black text-cyan-200 sm:text-3xl">{t('freeTitle')}</h2>
          <p className="mt-1 text-sm text-slate-200">{t('noDebit')}</p>
        </div>
        <p className="rounded-full border border-cyan-300 bg-[#092d3e] px-4 py-2 text-sm font-bold">{t('zero')}</p>
      </div>
      <div className="milestone-grid">
        {benefits.map(benefit => <PartnerBenefitCard key={benefit.id} benefit={benefit} preview={preview} />)}
      </div>
    </section>
  )
}
