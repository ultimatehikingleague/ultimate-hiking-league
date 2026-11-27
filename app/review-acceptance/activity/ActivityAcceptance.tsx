'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import RecordSubmissionForm from '@/app/components/RecordSubmissionForm'
import RecordEditRequestForm from '@/app/components/RecordEditRequestForm'
import { supabase } from '@/app/lib/supabase'

const edition = {eventMasterId:704, title:'Uferweg 2026 · Abnahme',date:'2026-10-10',country:'Deutschland',city:'Felsental',
  organizer:'Wanderwerk',distanceKm:30}

export default function ActivityAcceptance({edit, missingReview}: {edit:boolean; missingReview:boolean}) {
  const [hiker, setHiker] = useState<number>()
  useEffect(() => {
    void supabase.auth.getSession().then(({data}) => {
      if (data.session?.user.email==='hiker@example.invalid') setHiker(1)
    })
  }, [])
  return <main className="min-h-screen bg-[#141312] px-6 py-10 text-stone-100">
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/review-acceptance" className="text-amber-200 underline">Zur Abnahmeübersicht</Link>
      <h1 className="text-3xl font-bold">{edit ? 'Verifizierte Wanderleistung bearbeiten' : 'Veranstaltungsteilnahme einreichen'}</h1>
      {hiker ? edit
        ? <RecordEditRequestForm recordId={missingReview ? 7001 : 7021} hikerId={hiker} isOfficialEvent garminVerified={false}
          initialDescription={null} initialActivityName={missingReview ? "Felsenweg 2026 · Abnahme" : "Kammweg 2026 · Abnahme"} initialActivityDate={missingReview ? "2026-06-20" : "2026-09-12"}
          initialOfficialDistanceKm={missingReview ? 35 : 42} initialActualDistanceKm={missingReview ? 35 : 42} initialElapsedTimeText="08:45"
          initialElevationGain={null} initialCountry="Deutschland" initialLocation={missingReview ? "Felsental" : "Höhenwald"} initialRecordSource={missingReview ? "Wanderwerk" : "Kammwanderungen"} />
        : <RecordSubmissionForm hikerId={hiker} preselectedEvent={edition} />
      : <p>Wähle auf der Abnahmeübersicht zuerst „Als Test-Hiker“.</p>}
    </div>
  </main>
}
