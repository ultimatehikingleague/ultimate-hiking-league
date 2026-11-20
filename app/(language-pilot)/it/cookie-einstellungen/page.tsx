import { setItalianRequestLocale } from '@/i18n/italian-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/cookie-einstellungen/page'
import Scoped from '@/app/cookie-einstellungen/scoped-layout'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('it', '/cookie-einstellungen')
export default function LocalizedPage() {
  setItalianRequestLocale()
  return <Scoped><Page /></Scoped>
}
