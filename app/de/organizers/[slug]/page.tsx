import { setRequestLocale } from 'next-intl/server'
import { reviewPagePath } from '@/app/lib/event-reviews'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import { reviewCopy } from '@/app/lib/review-copy'
import Page from '@/app/organizers/[slug]/page'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params, searchParams }: Parameters<typeof Page>[0]) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  return { ...prototypeMetadata('de', reviewPagePath('/organizers/' + encodeURIComponent(slug), query)), title: reviewCopy('de').organizer }
}

export default function LocalizedPage(props: Parameters<typeof Page>[0]) {
  setRequestLocale('de')
  return <Page {...props} />
}
