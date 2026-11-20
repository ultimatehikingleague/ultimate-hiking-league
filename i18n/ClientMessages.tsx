'use client'

import { NextIntlClientProvider, useLocale, useMessages, type AbstractIntlMessages } from 'next-intl'
import type { ReactNode } from 'react'

export default function ClientMessages({ children, messages }: {
  children: ReactNode
  messages: AbstractIntlMessages
}) {
  const locale = useLocale()
  const inherited = useMessages()
  return <NextIntlClientProvider locale={locale} messages={{ ...inherited, ...messages }}>{children}</NextIntlClientProvider>
}
