import { Globe } from 'lucide-react'
import type { Language } from '../../i18n/language-register'

const flags: Partial<Record<Language, React.ReactNode>> = {
  de: <>
    <path fill="#000" d="M0 0h24v5H0z" />
    <path fill="#dd0000" d="M0 5h24v5H0z" />
    <path fill="#ffce00" d="M0 10h24v5H0z" />
  </>,
  en: <>
    <path fill="#012169" d="M0 0h24v15H0z" />
    <path stroke="#fff" strokeWidth="3" d="m0 0 24 15M24 0 0 15" />
    <path stroke="#c8102e" strokeWidth="1" d="m0 0 24 15M24 0 0 15" />
    <path stroke="#fff" strokeWidth="5" d="M12 0v15M0 7.5h24" />
    <path stroke="#c8102e" strokeWidth="3" d="M12 0v15M0 7.5h24" />
  </>,
  fr: <>
    <path fill="#002395" d="M0 0h8v15H0z" />
    <path fill="#fff" d="M8 0h8v15H8z" />
    <path fill="#ed2939" d="M16 0h8v15h-8z" />
  </>,
  nl: <>
    <path fill="#ae1c28" d="M0 0h24v5H0z" />
    <path fill="#fff" d="M0 5h24v5H0z" />
    <path fill="#21468b" d="M0 10h24v5H0z" />
  </>,
  cs: <>
    <path fill="#fff" d="M0 0h24v15H0z" />
    <path fill="#d7141a" d="M0 7.5h24V15H0z" />
    <path fill="#11457e" d="M0 0l12 7.5L0 15z" />
  </>,
  es: <>
    <path fill="#aa151b" d="M0 0h24v15H0z" />
    <path fill="#f1bf00" d="M0 3.75h24v7.5H0z" />
  </>,
  it: <>
    <path fill="#009246" d="M0 0h8v15H0z" />
    <path fill="#fff" d="M8 0h8v15H8z" />
    <path fill="#ce2b37" d="M16 0h8v15h-8z" />
  </>,
  pl: <>
    <path fill="#fff" d="M0 0h24v7.5H0z" />
    <path fill="#dc143c" d="M0 7.5h24V15H0z" />
  </>,
}

export default function LanguageIcon({ locale }: { locale: Language }) {
  const flag = flags[locale]
  if (!flag) return <Globe aria-hidden="true" className="h-4 w-5 shrink-0" />

  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 15"
      className="h-auto w-5 shrink-0 overflow-hidden rounded-[2px] ring-1 ring-white/20">
      {flag}
    </svg>
  )
}
