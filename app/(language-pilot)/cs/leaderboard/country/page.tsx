import { setCzechRequestLocale } from '@/i18n/czech-route'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/leaderboard/country/page'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('cs', '/leaderboard/country')
export default function LocalizedPage() {
  setCzechRequestLocale()
  return <Page />
}
