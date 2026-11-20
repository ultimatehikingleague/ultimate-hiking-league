import { setItalianRequestLocale } from '@/i18n/italian-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/skyscraper/page'
import Scoped from '@/app/skyscraper/scoped-layout'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('it', '/skyscraper')
export default function LocalizedPage() {
  setItalianRequestLocale()
  return <Scoped><Page /></Scoped>
}
