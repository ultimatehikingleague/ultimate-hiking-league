import { setCzechRequestLocale } from '@/i18n/czech-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/division/platinum/page'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('cs', '/division/platinum')
export default function LocalizedPage() {
  setCzechRequestLocale()
  return <Page />
}
