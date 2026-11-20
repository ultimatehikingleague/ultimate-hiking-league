import { setCzechRequestLocale } from '@/i18n/czech-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/division/silver/page'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('cs', '/division/silver')
export default function LocalizedPage() {
  setCzechRequestLocale()
  return <Page />
}
