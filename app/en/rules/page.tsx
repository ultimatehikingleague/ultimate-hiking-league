import { setRequestLocale } from 'next-intl/server'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/rules/page'

export const dynamic = 'error'

export const metadata = prototypeMetadata('en', '/rules')
export default function LocalizedPage() {
  setRequestLocale('en')
  return <Page />
}
