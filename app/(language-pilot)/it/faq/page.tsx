import { setItalianRequestLocale } from '@/i18n/italian-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/faq/page'

export const dynamic = 'error'

export const metadata = prototypeMetadata('it', '/faq')
export default function LocalizedPage() {
  setItalianRequestLocale()
  return <Page />
}
