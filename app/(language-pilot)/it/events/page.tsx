import { setItalianRequestLocale } from '@/i18n/italian-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/events/page'
import Scoped from '@/app/events/scoped-layout'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('it', '/events')
export default function LocalizedPage() {
  setItalianRequestLocale()
  return <Scoped><Page /></Scoped>
}
