import { setItalianRequestLocale } from '@/i18n/italian-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/rules/page'

export const dynamic = 'error'
export const metadata = prototypeMetadata('it', '/rules')

export default function LocalizedPage() {
  setItalianRequestLocale()
  return <Page />
}
