import type { PilotLocale, PublishedLocale } from './language-register'
import type { Wave1Locale } from './wave1'

export const catalogs = {
  de: () => import('../messages/de.json').then(module => module.default),
  en: () => import('../messages/en.json').then(module => module.default),
  fr: () => import('../messages/wave1/fr.json').then(module => module.default),
  nl: () => import('../messages/wave1/nl.json').then(module => module.default),
  pl: () => import('../messages/pl.json').then(module => module.default),
  it: () => import('../messages/it.json').then(module => module.default),
  es: () => import('../messages/es.json').then(module => module.default),
  cs: () => import('../messages/cs.json').then(module => module.default),
} satisfies Record<PublishedLocale | Wave1Locale, () => Promise<typeof import('../messages/en.json')>>

export const pilotCatalogs = {
  fr: () => import('../messages/pilot/fr.json').then(module => module.default),
  pl: () => import('../messages/pilot/pl.json').then(module => module.default),
  fi: () => import('../messages/pilot/fi.json').then(module => module.default),
  uk: () => import('../messages/pilot/uk.json').then(module => module.default),
  it: () => import('../messages/pilot/it.json').then(module => module.default),
  es: () => import('../messages/pilot/es.json').then(module => module.default),
  nl: () => import('../messages/pilot/nl.json').then(module => module.default),
  cs: () => import('../messages/pilot/cs.json').then(module => module.default),
  pt: () => import('../messages/pilot/pt.json').then(module => module.default),
  da: () => import('../messages/pilot/da.json').then(module => module.default),
  sv: () => import('../messages/pilot/sv.json').then(module => module.default),
  ru: () => import('../messages/pilot/ru.json').then(module => module.default),
} satisfies Record<PilotLocale, () => Promise<typeof import('../messages/pilot/fr.json')>>
