import { setRequestLocale } from 'next-intl/server'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/events/page'
import Scoped from '@/app/events/scoped-layout'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('en', '/events')
export default function LocalizedPage() {
  setRequestLocale('en')
  return <Scoped><Page /></Scoped>
}
