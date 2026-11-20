import { setCzechRequestLocale } from '@/i18n/czech-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/shop/schorschys-wanderkalender-2027/page'
import Scoped from '@/app/shop/schorschys-wanderkalender-2027/layout'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('cs', '/shop/schorschys-wanderkalender-2027')
export default function LocalizedPage() {
  setCzechRequestLocale()
  return <Scoped><Page /></Scoped>
}
