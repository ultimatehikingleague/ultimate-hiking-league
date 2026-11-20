import { requireWave1 } from '@/i18n/wave1-boundary'
import { setRequestLocale } from 'next-intl/server'
import { prototypeMetadata } from '@/i18n/prototype/metadata'
import Page from '@/app/shop/schorschys-wanderkalender-2027/page'
import Scoped from '@/app/shop/schorschys-wanderkalender-2027/layout'

export const dynamic = 'force-dynamic'

export const metadata = prototypeMetadata('nl', '/shop/schorschys-wanderkalender-2027')
export default function LocalizedPage() {
  setRequestLocale('nl')
  return <Scoped><Page /></Scoped>
}
