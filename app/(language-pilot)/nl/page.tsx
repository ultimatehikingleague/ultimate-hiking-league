import { requireWave1 } from '@/i18n/wave1-boundary'
import { setRequestLocale } from 'next-intl/server'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/home-page'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('nl', '/')
export default function LocalizedPage() {
  setRequestLocale('nl')
  return <Page />
}
