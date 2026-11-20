import { setRequestLocale } from 'next-intl/server'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/faq/page'

export const dynamic = 'error'

export const metadata = prototypeMetadata('en', '/faq')
export default function LocalizedPage() {
  setRequestLocale('en')
  return <Page />
}
