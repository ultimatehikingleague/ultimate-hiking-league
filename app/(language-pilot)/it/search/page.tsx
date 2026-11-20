import { setItalianRequestLocale } from '@/i18n/italian-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/search/page'

export const dynamic = 'force-dynamic'
type Props = Parameters<typeof Page>[0]

export const metadata = prototypeMetadata('it', '/search')
export default function LocalizedPage(props: Props) {
  setItalianRequestLocale()
  return <Page {...props} />
}
