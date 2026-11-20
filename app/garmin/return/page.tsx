import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { robots: { index: false }, referrer: 'no-referrer' }

export default async function GarminReturn({ searchParams }: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  return (
    <main className="mx-auto max-w-lg space-y-4 px-5 py-12">
      <h1 className="text-2xl font-semibold">Garmin Connect™</h1>
      {status === 'received' ? (
        <p>Kehre dorthin zurück, wo du die Verbindung gestartet hast: zum ursprünglichen Browser-Tab oder zur installierten UHL-Web-App. Wähle dort unter „Wanderung hinzufügen“ → „Aus Garmin importieren“ „Verbindung abschließen“. Falls die Schaltfläche fehlt, öffne „Aus Garmin importieren“ dort erneut.</p>
      ) : (
        <p>Dieser Rückruf konnte nicht verarbeitet werden. Falls du bereits von Garmin zurückgekehrt bist, prüfe den Verbindungsstatus unter „Aus Garmin importieren“ im ursprünglichen UHL-Tab. Dort kannst du auch einen neuen Versuch starten.</p>
      )}
      <Link href="/account#garmin-connect" className="underline">Garmin-Import in diesem Browser öffnen</Link>
    </main>
  )
}
