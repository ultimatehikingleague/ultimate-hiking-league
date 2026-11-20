import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { czechEnabled, wave1Enabled } from './wave1'

export function setCzechRequestLocale() {
  if (!wave1Enabled || !czechEnabled) notFound()
  setRequestLocale('cs')
}
