import { setSpanishRequestLocale } from '@/i18n/spanish-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/skyscraper/page'
import Scoped from '@/app/skyscraper/scoped-layout'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('es', '/skyscraper')
export default function LocalizedPage() {
  setSpanishRequestLocale()
  return <Scoped><Page /></Scoped>
}
