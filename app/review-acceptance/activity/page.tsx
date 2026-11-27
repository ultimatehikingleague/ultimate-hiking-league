import { notFound } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import de from '@/messages/de.json'
import ActivityAcceptance from './ActivityAcceptance'

export default async function ActivityAcceptancePage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  if (process.env.NODE_ENV !== 'development' || process.env.UHL_REVIEW_ACCEPTANCE !== '1') notFound()
  const {edit} = await searchParams
  return <NextIntlClientProvider locale="de" messages={de}>
    <ActivityAcceptance edit={edit === '1' || edit === 'missing'} missingReview={edit === 'missing'} />
  </NextIntlClientProvider>
}
