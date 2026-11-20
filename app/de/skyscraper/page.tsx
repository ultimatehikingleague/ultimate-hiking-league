import { setRequestLocale } from 'next-intl/server'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/skyscraper/page'
import Scoped from '@/app/skyscraper/scoped-layout'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('de', '/skyscraper')
export default function LocalizedPage() {
  setRequestLocale('de')
  return <Scoped><Page /></Scoped>
}
