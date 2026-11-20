import { setPolishRequestLocale } from '@/i18n/polish-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/shop/widerruf/erklaeren/page'
import Scoped from '@/app/shop/widerruf/erklaeren/layout'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('pl', '/shop/widerruf/erklaeren')
export default function LocalizedPage() {
  setPolishRequestLocale()
  return <Scoped><Page /></Scoped>
}
