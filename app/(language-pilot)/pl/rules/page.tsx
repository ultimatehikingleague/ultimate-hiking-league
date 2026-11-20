import { setPolishRequestLocale } from '@/i18n/polish-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/rules/page'

export const dynamic = 'error'
export const metadata = prototypeMetadata('pl', '/rules')

export default function LocalizedPage() {
  setPolishRequestLocale()
  return <Page />
}
