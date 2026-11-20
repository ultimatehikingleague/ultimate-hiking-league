import { setCzechRequestLocale } from '@/i18n/czech-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/faq/page'

export const dynamic = 'error'

export const metadata = prototypeMetadata('cs', '/faq')
export default function LocalizedPage() {
  setCzechRequestLocale()
  return <Page />
}
