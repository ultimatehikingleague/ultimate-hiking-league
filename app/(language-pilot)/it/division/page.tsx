import { setItalianRequestLocale } from '@/i18n/italian-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/division/page'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('it', '/division')
export default function LocalizedPage() {
  setItalianRequestLocale()
  return <Page />
}
