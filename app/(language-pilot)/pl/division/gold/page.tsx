import { setPolishRequestLocale } from '@/i18n/polish-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/division/gold/page'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('pl', '/division/gold')
export default function LocalizedPage() {
  setPolishRequestLocale()
  return <Page />
}
