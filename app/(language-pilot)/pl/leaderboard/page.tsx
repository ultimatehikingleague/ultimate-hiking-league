import { setPolishRequestLocale } from '@/i18n/polish-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/leaderboard/page'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('pl', '/leaderboard')
export default function LocalizedPage() {
  setPolishRequestLocale()
  return <Page />
}
