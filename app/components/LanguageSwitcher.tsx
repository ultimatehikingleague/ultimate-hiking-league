'use client'

import {
  createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, useTransition,
  type ReactNode,
} from 'react'
import { Check, ChevronDown, Globe } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { splitLanguagePath } from '../../i18n/public-paths'
import { setLanguage } from '../../i18n/actions'
import { fallbackLocale, isLocale, locales, resolveLanguage, type Locale } from '../../i18n/locales'

import { languageNames as names, pilotLanguages, publishedLanguages } from '../../i18n/language-register'
import { setPreviewLanguage } from '../../i18n/phase3-action'
import type { PreviewLocale } from '../../i18n/phase3'
import LanguageIcon from './LanguageIcon'

const languagePreference = createContext<{ manual: boolean; contextual?: boolean; browser?: Locale }>({ manual: false })
const subscribe = () => () => {}

export function LanguagePreference({ manual, contextual, browser, children }: {
  manual: boolean
  contextual: boolean
  browser: Locale
  children: ReactNode
}) {
  return <languagePreference.Provider value={{ manual, contextual, browser }}>{children}</languagePreference.Provider>
}

export default function LanguageSwitcher({ className = '', compact = false, preview }: {
  className?: string
  compact?: boolean
  preview?: { locale: PreviewLocale; manual: boolean; browser?: PreviewLocale; explicit?: boolean }
}) {
  const t = useTranslations('ui')
  const resolved = useLocale()
  const locale = preview?.locale ?? (isLocale(resolved) ? resolved : fallbackLocale)
  const current = names[locale]
  const prefixed = splitLanguagePath(usePathname())
  const preference = useContext(languagePreference)
  const { manual, contextual, browser } = preview ? { ...preview, contextual: false } : preference
  const explicit = preview ? Boolean(preview.explicit) : Boolean(prefixed)
  const choices = preview ? [...publishedLanguages, ...pilotLanguages] : locales
  const automatic = !manual && !contextual && !explicit
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false)
  const browserLocale = preview?.explicit && hydrated
    ? resolveLanguage(null, navigator.languages.join(','), choices, fallbackLocale)
    : browser ?? locale
  const [pending, startTransition] = useTransition()
  const [failed, setFailed] = useState(false)
  const details = useRef<HTMLDetailsElement>(null)
  const trigger = useRef<HTMLElement>(null)

  useEffect(() => {
    function dismissOutside(event: Event) {
      const menu = details.current
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) {
        menu.open = false
      }
    }

    // A tap on a button can blur the summary in WebKit before the click.
    document.addEventListener('pointerdown', dismissOutside, true)
    document.addEventListener('focusin', dismissOutside)
    return () => {
      document.removeEventListener('pointerdown', dismissOutside, true)
      document.removeEventListener('focusin', dismissOutside)
    }
  }, [])

  function close() {
    if (details.current) details.current.open = false
    trigger.current?.focus()
  }

  function choose(choice: PreviewLocale | 'auto') {
    close()
    if (!explicit && ((manual && choice === locale) || (automatic && choice === 'auto'))) return
    setFailed(false)
    startTransition(async () => {
      try {
        await (preview ? setPreviewLanguage(choice) : setLanguage(choice))
        if (preview && (preview.explicit || (choice !== 'auto' && choice !== 'de' && choice !== 'en'))) {
          const { search, hash } = window.location
          const target = choice === 'auto' || choice === 'de' || choice === 'en' ? '/phase3' : `/${choice}/rules`
          window.location.assign(target + search + hash)
          return
        }
        if (!preview && prefixed) {
          const { search, hash } = window.location
          const { pathname } = prefixed
          const target = choice === 'auto' ? pathname : `/${choice}${pathname === '/' ? '' : pathname}`
          window.location.assign(target + search + hash)
        }
      } catch {
        setFailed(true)
        if (details.current) details.current.open = true
      }
    })
  }

  const row = 'flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:opacity-60 md:min-h-9'
  return (
    <details ref={details} className={`group relative z-30 w-fit max-w-full text-stone-100 ${className}`}
      onKeyDown={event => {
        if (event.key === 'Escape' && details.current?.open) {
          event.preventDefault()
          close()
        }
      }}>
      <summary ref={trigger} aria-label={`${t('language')}: ${current.name}`} aria-busy={pending}
        className={`ml-auto flex min-h-11 min-w-11 w-fit cursor-pointer list-none items-center gap-1.5 rounded-lg px-2 font-semibold text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 [&::-webkit-details-marker]:hidden ${compact ? 'text-stone-300 hover:bg-white/10' : 'border border-white/15 bg-stone-950/85 shadow-sm hover:border-white/30'}`}>
        <LanguageIcon locale={locale} />
        <span translate="no" className="notranslate text-[11px] tracking-wider">{current.short}</span>
        <ChevronDown aria-hidden="true" className="h-3 w-3 text-stone-400 transition group-open:rotate-180" />
      </summary>
      <div className={`relative mt-1.5 md:absolute md:right-0 md:top-full md:mt-1.5 max-h-[min(20rem,55dvh)] overflow-y-auto overscroll-contain w-max min-w-48 max-w-[min(100%,calc(100vw-2rem))] rounded-xl border border-white/15 bg-[#201f1d] p-1.5 text-stone-100 shadow-xl shadow-black/45`}>
        {choices.map(choice => (
          <button key={choice} type="button" className={row} lang={choice} translate="no"
            disabled={!hydrated || pending} aria-pressed={(manual || explicit) && choice === locale}
            onClick={() => choose(choice)}>
            <LanguageIcon locale={choice} />
            <span className="flex-1">{names[choice].name}</span>
            {(manual || explicit) && choice === locale && <Check aria-hidden="true" className="h-4 w-4 text-cyan-300" />}
          </button>
        ))}
        <div className="mx-1 my-1 border-t border-white/10" />
        <button type="button" className={row} disabled={!hydrated || pending} aria-pressed={automatic}
          onClick={() => choose('auto')}>
          <Globe aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span className="flex-1">{t('browserLanguage', { language: names[browserLocale].name })}</span>
          {automatic && <Check aria-hidden="true" className="h-4 w-4 text-cyan-300" />}
        </button>
        {failed && <p role="alert" className="px-2.5 py-1.5 text-sm text-amber-200">{t('languageError')}</p>}
      </div>
    </details>
  )
}
