import { setPolishRequestLocale } from '@/i18n/polish-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/impressum/page'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('pl', '/impressum')
export default function LocalizedPage() {
  setPolishRequestLocale()
  return <Page />
}
