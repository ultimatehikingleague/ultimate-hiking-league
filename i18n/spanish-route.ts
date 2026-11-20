import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { spanishEnabled, wave1Enabled } from './wave1'

export function setSpanishRequestLocale() {
  if (!wave1Enabled || !spanishEnabled) notFound()
  setRequestLocale('es')
}
