import { setSpanishRequestLocale } from '@/i18n/spanish-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/shop/widerruf/erklaeren/page'
import Scoped from '@/app/shop/widerruf/erklaeren/layout'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('es', '/shop/widerruf/erklaeren')
export default function LocalizedPage() {
  setSpanishRequestLocale()
  return <Scoped><Page /></Scoped>
}
