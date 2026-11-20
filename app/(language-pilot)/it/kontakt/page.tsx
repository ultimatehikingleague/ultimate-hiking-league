import { setItalianRequestLocale } from '@/i18n/italian-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/kontakt/page'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('it', '/kontakt')
export default function LocalizedPage() {
  setItalianRequestLocale()
  return <Page />
}
