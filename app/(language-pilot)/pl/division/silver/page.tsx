import { setPolishRequestLocale } from '@/i18n/polish-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/division/silver/page'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('pl', '/division/silver')
export default function LocalizedPage() {
  setPolishRequestLocale()
  return <Page />
}
