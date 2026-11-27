'use client'

import Link from 'next/link'
import { useState } from 'react'
import { supabase } from '@/app/lib/supabase'

const routes = [
  ['/review-acceptance/activity', 'Teilnahme mit freiwilliger Bewertung einreichen'],
  ['/review-acceptance/activity?edit=missing', 'Bewertung zu verifizierter Wanderleistung ergänzen'],
  ['/review-acceptance/activity?edit=1', 'Bewertung zu verifizierter Wanderleistung überarbeiten'],
  ['/de/events/abnahme-felsenweg-2026','Veranstaltungsdetail und öffentliche Bewertungen'],
  ['/de/events/abnahme-kammweg-2026#reviews', 'Öffentliche Bewertungen zum Kammweg'],
  ['/de/leaderboard/event-reviews', 'Veranstaltungsranking'],
  ['/de/leaderboard/organizer-reviews', 'Veranstalterranking'],
  ['/de/organizers/abnahme-wanderwerk', 'Veranstalterseite'],
  ['/de/events', 'Eventkalender'],
  ['/de/datenschutz#event-reviews', 'Datenschutzinformationen'],
  ['/de/leaderboard', 'Sportliche Ranglisten und vergangene Veranstaltungen'],
] as const

export default function Acceptance() {
  const [status, setStatus] = useState('')
  async function changeRole(role: string, destination?: string) {
    if (role === 'guest') {
      const {error} = await supabase.auth.signOut()
      setStatus(error ? 'Der Rollenwechsel ist fehlgeschlagen.' : 'Gast ist aktiv.')
      return
    }
    const {error} = await supabase.auth.signInWithPassword({ email: `${role}@example.invalid`, password: 'local-review-fixture' })
    setStatus(error ? 'Der Rollenwechsel ist fehlgeschlagen.' : role === 'admin' ? 'Test-Admin ist aktiv.' : 'Test-Hiker ist aktiv.')
    if (!error && destination) window.location.assign(destination)
  }
  return <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100">
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-4xl font-bold">UHL-Bewertungen · lokale Abnahme</h1>
      <p className="text-stone-300">Diese Vorschau verwendet eine temporäre Datenbank mit synthetischen Veranstaltungen, Bewertungen und Konten. Eingaben und Freigaben wirken sich nur auf diese Vorschau aus.</p>
      <div className="flex flex-wrap gap-3">
        {[['hiker','Als Test-Hiker'], ['admin','Als Test-Admin'], ['guest','Als Gast']].map(([role,label]) =>
          <button key={role} onClick={() => void changeRole(role)} className="rounded-lg border border-white/20 px-4 py-2 hover:bg-white/10">{label}</button>
        )}
      </div>
      {status && <p role="status" className="text-amber-200">{status}</p>}
      <ul className="grid gap-3 sm:grid-cols-2">{routes.map(([href,label]) =>
        <li key={href}><Link href={href} className="block rounded-lg border border-white/15 p-3 hover:bg-white/10">{label}</Link></li>
      )}<li><button type="button" className="block w-full rounded-lg border border-white/15 p-3 text-start hover:bg-white/10"
        onClick={() => void changeRole('admin','/admin/event-reviews')}>Admin-Moderation öffnen</button></li></ul>
    </div>
  </main>
}
