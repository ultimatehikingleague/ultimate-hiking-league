import { setPolishRequestLocale } from '@/i18n/polish-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/skyscraper/page'
import Scoped from '@/app/skyscraper/scoped-layout'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('pl', '/skyscraper')
export default function LocalizedPage() {
  setPolishRequestLocale()
  return <Scoped><Page /></Scoped>
}
