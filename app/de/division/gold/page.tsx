import { setRequestLocale } from 'next-intl/server'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/division/gold/page'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('de', '/division/gold')
export default function LocalizedPage() {
  setRequestLocale('de')
  return <Page />
}
