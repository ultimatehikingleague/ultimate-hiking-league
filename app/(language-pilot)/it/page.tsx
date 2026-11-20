import { setItalianRequestLocale } from '@/i18n/italian-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/home-page'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('it', '/')
export default function LocalizedPage() {
  setItalianRequestLocale()
  return <Page />
}
