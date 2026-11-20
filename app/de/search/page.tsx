import { setRequestLocale } from 'next-intl/server'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/search/page'

export const dynamic = 'force-dynamic'
type Props = Parameters<typeof Page>[0]

export const metadata = prototypeMetadata('de', '/search')
export default function LocalizedPage(props: Props) {
  setRequestLocale('de')
  return <Page {...props} />
}
