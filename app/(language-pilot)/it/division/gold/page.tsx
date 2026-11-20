import { setItalianRequestLocale } from '@/i18n/italian-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/division/gold/page'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('it', '/division/gold')
export default function LocalizedPage() {
  setItalianRequestLocale()
  return <Page />
}
