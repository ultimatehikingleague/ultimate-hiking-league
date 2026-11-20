import { setPolishRequestLocale } from '@/i18n/polish-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/search/page'

export const dynamic = 'force-dynamic'
type Props = Parameters<typeof Page>[0]

export const metadata = prototypeMetadata('pl', '/search')
export default function LocalizedPage(props: Props) {
  setPolishRequestLocale()
  return <Page {...props} />
}
