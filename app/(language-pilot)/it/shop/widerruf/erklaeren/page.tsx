import { setItalianRequestLocale } from '@/i18n/italian-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/shop/widerruf/erklaeren/page'
import Scoped from '@/app/shop/widerruf/erklaeren/layout'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('it', '/shop/widerruf/erklaeren')
export default function LocalizedPage() {
  setItalianRequestLocale()
  return <Scoped><Page /></Scoped>
}
