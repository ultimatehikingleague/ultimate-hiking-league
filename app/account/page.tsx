import { headers } from 'next/headers'
import AccountPage from './AccountPage'
import RecordSubmissionForm from '../components/RecordSubmissionForm'

export default async function Page({ searchParams }: { searchParams: Promise<{ garminPreview?: string }> }) {
  if (process.env.NODE_ENV === 'development' && (await searchParams).garminPreview === '1') {
    const host = (await headers()).get('host') ?? ''
    if (/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)) {
      return <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <h1 className="text-2xl font-semibold">Garmin Connect lokal testen</h1>
        <p>Die Vorschau liest Bilder im Browser. Einreichung und Nachweisspeicherung sind deaktiviert.</p>
        <RecordSubmissionForm hikerId={0} previewOnly />
      </main>
    }
  }
  return <AccountPage />
}
