import { setCzechRequestLocale } from '@/i18n/czech-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/cookie-einstellungen/page'
import Scoped from '@/app/cookie-einstellungen/scoped-layout'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('cs', '/cookie-einstellungen')
export default function LocalizedPage() {
  setCzechRequestLocale()
  return <Scoped><Page /></Scoped>
}
