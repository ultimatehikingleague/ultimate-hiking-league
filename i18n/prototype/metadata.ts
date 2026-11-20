import type { Metadata } from 'next'
import { publishedLanguages } from '../language-register'
import { fallbackLocale, locales, type Locale } from '../locales'
import { wave1Enabled, wave1ReleaseBuild } from '../wave1'

const vercelPreviewHost = process.env.VERCEL_ENV === 'preview' ? process.env.VERCEL_URL : undefined
const previewOrigin = process.env.UHL_PHASE3_ORIGIN ||
  (vercelPreviewHost ? `https://${vercelPreviewHost}` : 'http://localhost:55388')
const origin = wave1Enabled && !wave1ReleaseBuild ? previewOrigin : 'https://www.ultimatehikingleague.com'

export function prototypeMetadata(locale: Locale, pathname: string): Metadata {
  const url = (lang: Locale) => `${origin}/${lang}${pathname === '/' ? '' : pathname}`
  return {
    title: 'Ultimate European Hiking League',
    ...(wave1Enabled && !wave1ReleaseBuild ? { robots: { index: false, follow: false } } : {}),
    alternates: {
      canonical: url(locale),
      languages: { ...Object.fromEntries((wave1Enabled ? locales : publishedLanguages).map(code => [code, url(code)])), 'x-default': url(fallbackLocale) },
    },
  }
}
