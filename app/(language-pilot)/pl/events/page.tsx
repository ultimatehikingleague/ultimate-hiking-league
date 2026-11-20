import { setPolishRequestLocale } from '@/i18n/polish-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/events/page'
import Scoped from '@/app/events/scoped-layout'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('pl', '/events')
export default function LocalizedPage() {
  setPolishRequestLocale()
  return <Scoped><Page /></Scoped>
}
