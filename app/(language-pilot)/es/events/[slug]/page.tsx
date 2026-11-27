import { setSpanishRequestLocale } from '@/i18n/spanish-route'
import { reviewPagePath } from '@/app/lib/event-reviews'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/events/[slug]/page'

export const dynamic = 'force-dynamic'
type Props = Parameters<typeof Page>[0]

export async function generateMetadata({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  return prototypeMetadata('es', reviewPagePath('/events/' + encodeURIComponent(slug), query))
}
export default function LocalizedPage(props: Props) {
  setSpanishRequestLocale()
  return <Page {...props} />
}
