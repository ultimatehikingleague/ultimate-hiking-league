import { setPolishRequestLocale } from '@/i18n/polish-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/[hiker]/page'
import Scoped from '@/app/[hiker]/scoped-layout'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'
type Props = Parameters<typeof Page>[0]

export async function generateMetadata({ params }: Props) {
  const { hiker } = await params
  if (!/^[1-9]\d*$/.test(hiker)) notFound()
  return prototypeMetadata('pl', '/' + encodeURIComponent(hiker))
}
export default function LocalizedPage(props: Props) {
  setPolishRequestLocale()
  return <Scoped><Page {...props} /></Scoped>
}
