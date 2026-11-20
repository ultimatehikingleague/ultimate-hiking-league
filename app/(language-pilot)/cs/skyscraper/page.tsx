import { setCzechRequestLocale } from '@/i18n/czech-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/skyscraper/page'
import Scoped from '@/app/skyscraper/scoped-layout'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('cs', '/skyscraper')
export default function LocalizedPage() {
  setCzechRequestLocale()
  return <Scoped><Page /></Scoped>
}
