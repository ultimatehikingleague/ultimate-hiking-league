import { setCzechRequestLocale } from '@/i18n/czech-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/search/page'

export const dynamic = 'force-dynamic'
type Props = Parameters<typeof Page>[0]

export const metadata = prototypeMetadata('cs', '/search')
export default function LocalizedPage(props: Props) {
  setCzechRequestLocale()
  return <Page {...props} />
}
