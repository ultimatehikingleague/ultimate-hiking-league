import { setPolishRequestLocale } from '@/i18n/polish-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/division/page'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('pl', '/division')
export default function LocalizedPage() {
  setPolishRequestLocale()
  return <Page />
}
