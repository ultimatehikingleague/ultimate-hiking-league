import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { pilotLanguages, publishedLanguages } from './language-register'
import { resolveLanguage } from './locales'

export const previewLanguages = [...publishedLanguages, ...pilotLanguages] as const
export type PreviewLocale = (typeof previewLanguages)[number]
export const previewCookie = 'uhl_phase3_language'
export const previewEnabled = process.env.UHL_PHASE3_PREVIEW === '1' && process.env.VERCEL_ENV !== 'production'

export function isPreviewLocale(value: unknown): value is PreviewLocale {
  return previewLanguages.some(locale => locale === value)
}

export function requirePreview() {
  if (!previewEnabled) notFound()
}

export const previewPreference = cache(async () => {
  requirePreview()
  const [jar, request] = await Promise.all([cookies(), headers()])
  const manual = jar.get(previewCookie)?.value
  const browser = resolveLanguage(null, request.get('accept-language'), previewLanguages, 'en')
  return { locale: isPreviewLocale(manual) ? manual : browser, manual: isPreviewLocale(manual), browser }
})

export function previewRulesPath(locale: PreviewLocale) {
  return locale === 'de' || locale === 'en' ? '/phase3' : `/${locale}/rules`
}

export function previewMetadata(locale?: (typeof pilotLanguages)[number]): Metadata {
  if (!locale) return { robots: { index: false, follow: false } }
  const origin = process.env.UHL_PHASE3_ORIGIN || 'http://localhost:55388'
  const url = (code: PreviewLocale) => new URL(previewRulesPath(code), origin).href
  return {
    robots: { index: false, follow: false },
    alternates: {
      canonical: url(locale),
      languages: { ...Object.fromEntries(pilotLanguages.map(code => [code, url(code)])), 'x-default': url('en') },
    },
  }
}
