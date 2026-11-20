import { setSpanishRequestLocale } from '@/i18n/spanish-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/shop/schorschys-wanderkalender-2027/page'
import Scoped from '@/app/shop/schorschys-wanderkalender-2027/layout'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('es', '/shop/schorschys-wanderkalender-2027')
export default function LocalizedPage() {
  setSpanishRequestLocale()
  return <Scoped><Page /></Scoped>
}
