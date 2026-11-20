import { setSpanishRequestLocale } from '@/i18n/spanish-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/leaderboard/page'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('es', '/leaderboard')
export default function LocalizedPage() {
  setSpanishRequestLocale()
  return <Page />
}
