'use client'

import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import GarminActivityConnect from './GarminActivityConnect'
import RecordSubmissionForm, { activityGpsImportEnabled } from './RecordSubmissionForm'
import type { GarminInboxActivity } from '../lib/activity/garmin-metrics'

type Entry = 'closed' | 'choose' | 'manual' | 'import' | 'garmin'

const button = 'min-h-11 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-left text-sm font-medium text-stone-100 hover:bg-white/10'

export default function RecordSubmissionPanel({ hikerId, onPublished }: { hikerId: number; onPublished: () => void }) {
  const t = useTranslations('submissionPanel')

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
          {submitted === 'published' ? t('theGarminHikeHasBeenPublished') : t('hikeSubmittedForReview')}
        </p>
      )}
      {entry === 'closed' && (
        <button type="button" className={button} onClick={() => {
          setSubmitted(null)
          setEntry('choose')
        }}>{submitted ? t('addAnotherHike') : t('addAHike')}</button>
      )}
      {entry === 'choose' && (
        <div role="group" aria-label={t('addAHike')} className="grid gap-2 sm:grid-cols-3">
          <button type="button" className={button} onClick={() => setEntry('manual')}>{t('enterManually')}</button>
          {activityGpsImportEnabled() && (
            <button type="button" className={button} onClick={() => setEntry('import')}>{t('importAGpxFitOrTcx')}</button>
          )}
          <button type="button" className={`${button} flex flex-wrap items-center gap-3`} onClick={() => setEntry('garmin')}>
            <Image src="/images/garmin/garmin-connect-tile.png" alt="" width={88} height={88} unoptimized />
            <span>{t('importFromGarminConnect')}</span>
          </button>
          <button type="button" className="min-h-11 text-left text-sm text-stone-300 underline" onClick={() => setEntry('closed')}>{t('close')}</button>
        </div>
      )}
      {entry === 'garmin' && (
        <>
          <button type="button" className={button} onClick={() => {
            setGarminActivity(undefined)
            setEntry('choose')
          }}>{t('backToOptions')}</button>
          {garminActivity && (
            <button type="button" className={button} onClick={() => setGarminActivity(undefined)}>
              {t('backToGarminActivities')}
            </button>
          )}
          {garminActivity
            ? <RecordSubmissionForm hikerId={hikerId} garminActivity={garminActivity}
                garminSubmissionEnabled={garminSubmissionEnabled}
                onSuccess={result => {
                  setGarminActivity(undefined)
                  setSubmitted(result === 'review' ? 'review' : 'published')
                  if (result !== 'review') onPublished()
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
