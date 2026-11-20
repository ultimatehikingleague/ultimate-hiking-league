import { setItalianRequestLocale } from '@/i18n/italian-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/challenges/[slug]/page'

export const dynamic = 'force-dynamic'
type Props = Parameters<typeof Page>[0]

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  return prototypeMetadata('it', '/challenges/' + encodeURIComponent(slug))
}
export default function LocalizedPage(props: Props) {
  setItalianRequestLocale()
  return <Page {...props} />
}
