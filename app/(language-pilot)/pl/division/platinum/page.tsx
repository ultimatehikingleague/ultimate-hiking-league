import { setPolishRequestLocale } from '@/i18n/polish-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/division/platinum/page'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('pl', '/division/platinum')
export default function LocalizedPage() {
  setPolishRequestLocale()
  return <Page />
}
