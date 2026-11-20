import { setRequestLocale } from 'next-intl/server'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/cookie-einstellungen/page'
import Scoped from '@/app/cookie-einstellungen/scoped-layout'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('en', '/cookie-einstellungen')
export default function LocalizedPage() {
  setRequestLocale('en')
  return <Scoped><Page /></Scoped>
}
