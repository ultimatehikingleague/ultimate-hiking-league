import { setSpanishRequestLocale } from '@/i18n/spanish-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/search/page'

export const dynamic = 'force-dynamic'
type Props = Parameters<typeof Page>[0]

export const metadata = prototypeMetadata('es', '/search')
export default function LocalizedPage(props: Props) {
  setSpanishRequestLocale()
  return <Page {...props} />
}
