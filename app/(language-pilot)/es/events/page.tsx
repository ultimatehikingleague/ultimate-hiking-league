import { setSpanishRequestLocale } from '@/i18n/spanish-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/events/page'
import Scoped from '@/app/events/scoped-layout'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('es', '/events')
export default function LocalizedPage() {
  setSpanishRequestLocale()
  return <Scoped><Page /></Scoped>
}
