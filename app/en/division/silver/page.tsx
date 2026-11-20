import { setRequestLocale } from 'next-intl/server'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/division/silver/page'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('en', '/division/silver')
export default function LocalizedPage() {
  setRequestLocale('en')
  return <Page />
}
