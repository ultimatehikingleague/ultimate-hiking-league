import { setSpanishRequestLocale } from '@/i18n/spanish-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/rules/page'

export const dynamic = 'error'
export const metadata = prototypeMetadata('es', '/rules')

export default function LocalizedPage() {
  setSpanishRequestLocale()
  return <Page />
}
