import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { italianEnabled, wave1Enabled } from './wave1'

export function setItalianRequestLocale() {
  if (!wave1Enabled || !italianEnabled) notFound()
  setRequestLocale('it')
}
