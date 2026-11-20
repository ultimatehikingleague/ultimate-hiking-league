import { setPolishRequestLocale } from '@/i18n/polish-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/challenges/[slug]/page'

export const dynamic = 'force-dynamic'
type Props = Parameters<typeof Page>[0]

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  return prototypeMetadata('pl', '/challenges/' + encodeURIComponent(slug))
}
export default function LocalizedPage(props: Props) {
  setPolishRequestLocale()
  return <Page {...props} />
}
