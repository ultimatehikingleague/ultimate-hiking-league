import { setRequestLocale } from 'next-intl/server'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/leaderboard/page'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('en', '/leaderboard')
export default function LocalizedPage() {
  setRequestLocale('en')
  return <Page />
}
