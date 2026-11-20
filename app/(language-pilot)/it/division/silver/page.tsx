import { setItalianRequestLocale } from '@/i18n/italian-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/division/silver/page'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('it', '/division/silver')
export default function LocalizedPage() {
  setItalianRequestLocale()
  return <Page />
}
