'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import GarminActivityConnect from './GarminActivityConnect'
import RecordSubmissionForm, { activityGpsImportEnabled } from './RecordSubmissionForm'
import type { GarminInboxActivity } from '../lib/activity/garmin-metrics'

type Entry = 'closed' | 'choose' | 'manual' | 'import' | 'garmin'

const button = 'min-h-11 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-left text-sm font-medium text-stone-100 hover:bg-white/10'

export default function RecordSubmissionPanel({ hikerId, onPublished }: { hikerId: number; onPublished: () => void }) {
  const [entry, setEntry] = useState<Entry>('closed')
  const [submitted, setSubmitted] = useState<'review' | 'published' | null>(null)
  const [garminSubmissionEnabled, setGarminSubmissionEnabled] = useState(false)
  const [garminActivity, setGarminActivity] = useState<GarminInboxActivity>()

  useEffect(() => {
    function openGarminFromLink() {
      if (window.location.hash === '#garmin-connect') setEntry('garmin')
    }
    openGarminFromLink()
    window.addEventListener('hashchange', openGarminFromLink)
    return () => window.removeEventListener('hashchange', openGarminFromLink)
  }, [])

  return (
    <div id="garmin-connect" className="w-full scroll-mt-6 space-y-3">
      {submitted && (
        <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">
          {submitted === 'published' ? 'Die Garmin-Wanderung ist veröffentlicht.' : 'Wanderung eingereicht. Deine Einreichung wird geprüft.'}
        </p>
      )}
      {entry === 'closed' && (
        <button type="button" className={button} onClick={() => {
          setSubmitted(null)
          setEntry('choose')
        }}>{submitted ? 'Weitere Wanderung hinzufügen' : 'Wanderung hinzufügen'}</button>
      )}
      {entry === 'choose' && (
        <div role="group" aria-label="Wanderung hinzufügen" className="grid gap-2 sm:grid-cols-3">
          <button type="button" className={button} onClick={() => setEntry('manual')}>Manuell eintragen</button>
          {activityGpsImportEnabled() && (
            <button type="button" className={button} onClick={() => setEntry('import')}>GPX-, FIT- oder TCX-Datei importieren</button>
          )}
          <button type="button" className={`${button} flex flex-wrap items-center gap-3`} onClick={() => setEntry('garmin')}>
            <Image src="/images/garmin/garmin-connect-tile.png" alt="" width={88} height={88} unoptimized />
            <span>Aus Garmin Connect™ importieren</span>
          </button>
          <button type="button" className="min-h-11 text-left text-sm text-stone-300 underline" onClick={() => setEntry('closed')}>Schließen</button>
        </div>
      )}
      {entry === 'garmin' && (
        <>
          <button type="button" className={button} onClick={() => {
            setGarminActivity(undefined)
            setEntry('choose')
          }}>Zurück zur Auswahl</button>
          {garminActivity && (
            <button type="button" className={button} onClick={() => setGarminActivity(undefined)}>
              Zurück zu Garmin-Aktivitäten
            </button>
          )}
          {garminActivity
            ? <RecordSubmissionForm hikerId={hikerId} garminActivity={garminActivity}
                garminSubmissionEnabled={garminSubmissionEnabled}
                onSuccess={() => {
                  setGarminActivity(undefined)
                  setSubmitted('published')
                  onPublished()
                  setEntry('closed')
                }} />
            : <GarminActivityConnect onSelect={(activity, enabled) => {
              setGarminSubmissionEnabled(enabled)
              setGarminActivity(activity)
            }} />}
        </>
      )}
      {(entry === 'manual' || entry === 'import') && (
        <RecordSubmissionForm
          key={entry}
          hikerId={hikerId}
          initialEntryMode={entry}
          onSuccess={() => {
            setSubmitted('review')
            setEntry('closed')
          }}
          onCancel={() => setEntry('choose')}
        />
      )}
    </div>
  )
}
