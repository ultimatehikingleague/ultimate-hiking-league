import { requireWave1 } from '@/i18n/wave1-boundary'
import { setRequestLocale } from 'next-intl/server'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/search/page'

export const dynamic = 'force-dynamic'
type Props = Parameters<typeof Page>[0]

export const metadata = prototypeMetadata('nl', '/search')
export default function LocalizedPage(props: Props) {
  setRequestLocale('nl')
  return <Page {...props} />
}
