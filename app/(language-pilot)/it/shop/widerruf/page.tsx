import { setItalianRequestLocale } from '@/i18n/italian-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/shop/widerruf/page'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('it', '/shop/widerruf')
export default function LocalizedPage() {
  setItalianRequestLocale()
  return <Page />
}
