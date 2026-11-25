'use client'

import { Fragment } from 'react'
import { useTranslations } from 'next-intl'

export function externalOfferUrl(value: string | null | undefined) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? value : null
  } catch {
    return null
  }
}

export default function OfferText({ text, linkify = true }: { text: string; linkify?: boolean }) {
  const t = useTranslations('partnerBenefits')

  return text.split(/(https?:\/\/[^\s<>"“”]+)/gi).map((part, index) => {
    if (index % 2 === 0) return <Fragment key={index}>{part}</Fragment>
    let candidate = part.replace(/[.,;!?]+$/, '')
    if (candidate.endsWith(')') && candidate.split(')').length > candidate.split('(').length) {
      candidate = candidate.slice(0, -1)
    }
    const url = externalOfferUrl(candidate)
    return (
      <Fragment key={index}>
        {linkify && url && <a href={url} target="_blank" rel="noopener noreferrer" className="text-cyan-200 underline underline-offset-2">{t('relatedLink', { host: new URL(url).hostname })}</a>}
        {part.slice(candidate.length)}
      </Fragment>
    )
  })
}
