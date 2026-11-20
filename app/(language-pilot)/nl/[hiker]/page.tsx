import { requireWave1 } from '@/i18n/wave1-boundary'
import { setRequestLocale } from 'next-intl/server'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/[hiker]/page'
import Scoped from '@/app/[hiker]/scoped-layout'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'
type Props = Parameters<typeof Page>[0]

export async function generateMetadata({ params }: Props) {
  requireWave1()
  const { hiker } = await params
  if (!/^[1-9]\d*$/.test(hiker)) notFound()
  return prototypeMetadata('nl', '/' + encodeURIComponent(hiker))
}
export default function LocalizedPage(props: Props) {
  setRequestLocale('nl')
  return <Scoped><Page {...props} /></Scoped>
}
