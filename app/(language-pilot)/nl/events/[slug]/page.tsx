import { requireWave1 } from '@/i18n/wave1-boundary'
import { setRequestLocale } from 'next-intl/server'
import { reviewPagePath } from '@/app/lib/event-reviews'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/events/[slug]/page'

export const dynamic = 'force-dynamic'
type Props = Parameters<typeof Page>[0]

export async function generateMetadata({ params, searchParams }: Props) {
  requireWave1()
  const [{ slug }, query] = await Promise.all([params, searchParams])
  return prototypeMetadata('nl', reviewPagePath('/events/' + encodeURIComponent(slug), query))
}
export default function LocalizedPage(props: Props) {
  setRequestLocale('nl')
  return <Page {...props} />
}
