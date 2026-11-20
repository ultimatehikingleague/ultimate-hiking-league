import { setSpanishRequestLocale } from '@/i18n/spanish-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/cookie-einstellungen/page'
import Scoped from '@/app/cookie-einstellungen/scoped-layout'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('es', '/cookie-einstellungen')
export default function LocalizedPage() {
  setSpanishRequestLocale()
  return <Scoped><Page /></Scoped>
}
