import { setCzechRequestLocale } from '@/i18n/czech-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/events/page'
import Scoped from '@/app/events/scoped-layout'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('cs', '/events')
export default function LocalizedPage() {
  setCzechRequestLocale()
  return <Scoped><Page /></Scoped>
}
