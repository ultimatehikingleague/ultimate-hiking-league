import { requireWave1 } from '@/i18n/wave1-boundary'
import { setRequestLocale } from 'next-intl/server'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/challenges/[slug]/page'

export const dynamic = 'force-dynamic'
type Props = Parameters<typeof Page>[0]

export async function generateMetadata({ params }: Props) {
  requireWave1()
  const { slug } = await params
  return prototypeMetadata('fr', '/challenges/' + encodeURIComponent(slug))
}
export default function LocalizedPage(props: Props) {
  setRequestLocale('fr')
  return <Page {...props} />
}
