import { setRequestLocale } from 'next-intl/server'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/shop/widerruf/erklaeren/page'
import Scoped from '@/app/shop/widerruf/erklaeren/layout'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('en', '/shop/widerruf/erklaeren')
export default function LocalizedPage() {
  setRequestLocale('en')
  return <Scoped><Page /></Scoped>
}
