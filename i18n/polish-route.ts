import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { polishEnabled, wave1Enabled } from './wave1'

export function setPolishRequestLocale() {
  if (!wave1Enabled || !polishEnabled) notFound()
  setRequestLocale('pl')
}
