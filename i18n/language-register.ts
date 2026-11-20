export const publishedLanguages = ['de', 'en'] as const
export const plannedLanguages = ['fr', 'it', 'es', 'nl', 'pl', 'cs', 'pt', 'da', 'fi', 'sv', 'uk', 'ru'] as const
export const pilotLanguages = plannedLanguages

export type PublishedLocale = (typeof publishedLanguages)[number]
export type PilotLocale = (typeof pilotLanguages)[number]
export type Language = PublishedLocale | (typeof plannedLanguages)[number]

export const languageNames: Record<Language, { name: string; short: string }> = {
  de: { name: 'Deutsch', short: 'DE' },
  en: { name: 'English', short: 'EN' },
  fr: { name: 'Français', short: 'FR' },
  it: { name: 'Italiano', short: 'IT' },
  es: { name: 'Español', short: 'ES' },
  nl: { name: 'Nederlands', short: 'NL' },
  pl: { name: 'Polski', short: 'PL' },
  cs: { name: 'Čeština', short: 'CS' },
  pt: { name: 'Português', short: 'PT' },
  da: { name: 'Dansk', short: 'DA' },
  fi: { name: 'Suomi', short: 'FI' },
  sv: { name: 'Svenska', short: 'SV' },
  uk: { name: 'Українська', short: 'UK' },
  ru: { name: 'Русский', short: 'RU' },
}
