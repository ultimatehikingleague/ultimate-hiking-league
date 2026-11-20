
import { publishedLanguages } from './language-register'

import { wave1Enabled, wave1Languages, type Wave1Locale } from './wave1'

export const locales: readonly ((typeof publishedLanguages)[number] | Wave1Locale)[] =
  wave1Enabled ? [...publishedLanguages, ...wave1Languages] : publishedLanguages
export type Locale = (typeof locales)[number]
export const fallbackLocale: Locale = 'en'
export const languageCookie = 'uhl_language'

export function isLocale(value: unknown): value is Locale {
  return locales.some(locale => locale === value)
}

export function resolveLanguage<T extends string>(preference: unknown, acceptLanguage: string | null, available: readonly T[], fallback: T): T {
  const manual = available.find(locale => locale === preference)
  if (manual) return manual
  const requested = (acceptLanguage ?? '').split(',').slice(0, 32).map(entry => {
    const [tag, ...parameters] = entry.trim().split(';')
    const qualityParameter = parameters.find(parameter => /^\s*q\s*=/i.test(parameter))
    const quality = qualityParameter === undefined ? 1 : Number(qualityParameter.split('=')[1]?.trim())
    return { tag: tag.trim(), quality }
  }).filter(({ tag, quality }) => tag !== '*' && tag && quality > 0 && quality <= 1)
    .sort((a, b) => b.quality - a.quality)
  for (const { tag } of requested) {
    try {
      const canonical = Intl.getCanonicalLocales(tag)[0]
      const matched = new Intl.Locale(canonical).language
      const supported = available.find(locale => locale === matched)
      if (supported) return supported
    } catch (error) {
      if (!(error instanceof RangeError)) throw error
    }
  }
  return fallback
}

export function resolveLocale(preference: unknown, acceptLanguage: string | null): Locale {
  return resolveLanguage(preference, acceptLanguage, locales, fallbackLocale)
}
