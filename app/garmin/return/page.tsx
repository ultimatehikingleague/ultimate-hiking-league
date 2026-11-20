import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import Link from '@/i18n/prototype/LocalizedLink'

export const metadata: Metadata = { robots: { index: false }, referrer: 'no-referrer' }

export default async function GarminReturn({ searchParams }: {
  searchParams: Promise<{ status?: string }>
}) {
  const t = await getTranslations('garminReturn')

  const { status } = await searchParams
  return (
    <main className="mx-auto max-w-lg space-y-4 px-5 py-12">
      <h1 className="text-2xl font-semibold">Garmin Connect™</h1>
      {status === 'received' ? (
        <p>{t('returnToConnection')}</p>
      ) : (
        <p>{t('returnFailed')}</p>
      )}
      <Link href="/account#garmin-connect" className="underline">{t('openGarminImportInThisBrowser')}</Link>
    </main>
  )
}
