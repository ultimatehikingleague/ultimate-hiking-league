'use client'

import type { ComponentProps } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import LanguageSwitcher from '@/app/components/LanguageSwitcher'

export default function PilotLanguageMenu({ preference, ui }: {
  preference: NonNullable<ComponentProps<typeof LanguageSwitcher>['preview']>
  ui: { language: string; browserLanguage: string; languageError: string }
}) {
  return (
    <NextIntlClientProvider locale={preference.locale} messages={{ ui }}>
      <LanguageSwitcher className="relative" preview={preference} />
    </NextIntlClientProvider>
  )
}
