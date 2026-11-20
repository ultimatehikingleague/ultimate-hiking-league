import { setCzechRequestLocale } from '@/i18n/czech-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/rules/page'

export const dynamic = 'error'
export const metadata = prototypeMetadata('cs', '/rules')

export default function LocalizedPage() {
  setCzechRequestLocale()
  return <Page />
}
