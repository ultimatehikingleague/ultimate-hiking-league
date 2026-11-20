import { setRequestLocale } from 'next-intl/server'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/shop/page'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('en', '/shop')
export default function LocalizedPage() {
  setRequestLocale('en')
  return <Page />
}
