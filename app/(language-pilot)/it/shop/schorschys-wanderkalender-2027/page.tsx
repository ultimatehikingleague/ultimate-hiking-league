import { setItalianRequestLocale } from '@/i18n/italian-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/shop/schorschys-wanderkalender-2027/page'
import Scoped from '@/app/shop/schorschys-wanderkalender-2027/layout'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('it', '/shop/schorschys-wanderkalender-2027')
export default function LocalizedPage() {
  setItalianRequestLocale()
  return <Scoped><Page /></Scoped>
}
