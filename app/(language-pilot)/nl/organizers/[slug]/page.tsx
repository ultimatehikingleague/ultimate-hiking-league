import { setRequestLocale } from 'next-intl/server'
import { reviewPagePath } from '@/app/lib/event-reviews'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import { reviewCopy } from '@/app/lib/review-copy'
import { requireWave1 } from '@/i18n/wave1-boundary'
import Page from '@/app/organizers/[slug]/page'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params, searchParams }: Parameters<typeof Page>[0]) {
  requireWave1()
  const [{ slug }, query] = await Promise.all([params, searchParams])
  return { ...prototypeMetadata('nl', reviewPagePath('/organizers/' + encodeURIComponent(slug), query)), title: reviewCopy('nl').organizer }
}

export default function LocalizedPage(props: Parameters<typeof Page>[0]) {
  requireWave1()
  setRequestLocale('nl')
  return <Page {...props} />
}
