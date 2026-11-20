import { setCzechRequestLocale } from '@/i18n/czech-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/shop/widerruf/erklaeren/page'
import Scoped from '@/app/shop/widerruf/erklaeren/layout'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('cs', '/shop/widerruf/erklaeren')
export default function LocalizedPage() {
  setCzechRequestLocale()
  return <Scoped><Page /></Scoped>
}
