import { setSpanishRequestLocale } from '@/i18n/spanish-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/events/[slug]/page'

export const dynamic = 'force-dynamic'
type Props = Parameters<typeof Page>[0]

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  return prototypeMetadata('es', '/events/' + encodeURIComponent(slug))
}
export default function LocalizedPage(props: Props) {
  setSpanishRequestLocale()
  return <Page {...props} />
}
