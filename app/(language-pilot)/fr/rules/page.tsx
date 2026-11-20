import { setRequestLocale } from 'next-intl/server'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import { previewMetadata } from '@/i18n/phase3'
import { PilotPage } from '@/i18n/pilot-view'
import { wave1Enabled } from '@/i18n/wave1'
import Page from '@/app/rules/page'

export const dynamic = 'error'
export const metadata = wave1Enabled ? prototypeMetadata('fr', '/rules') : previewMetadata('fr')

export default function LocalizedPage() {
  if (!wave1Enabled) return <PilotPage locale="fr" />
  setRequestLocale('fr')
  return <Page />
}
