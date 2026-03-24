'use client'

import { useState } from 'react'
import RecordSubmissionForm from './RecordSubmissionForm'

type RecordSubmissionPanelProps = {
  hikerId: number
}

export default function RecordSubmissionPanel({
  hikerId,
}: RecordSubmissionPanelProps) {
  const [open, setOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  function handleSuccess() {
    setSubmitted(true)
    setOpen(false)
  }

  if (submitted) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-4 text-sm text-emerald-200">
        <div className="font-medium">Wanderung eingereicht</div>
        <div className="mt-1 text-xs text-emerald-300/80">
          Deine Einreichung wird geprüft.
        </div>
      </div>

      <button
        onClick={() => setSubmitted(false)}
        className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
      >
        Weitere Wanderung hinzufügen
      </button>
    </div>
  )
}

  return (
    <div className="w-full">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-stone-100 transition hover:-translate-y-0.5 hover:bg-white/10"
        >
          Wanderung hinzufügen
        </button>
      ) : (
        <RecordSubmissionForm
          hikerId={hikerId}
          onSuccess={handleSuccess}
          onCancel={() => setOpen(false)}
        />
      )}
    </div>
  )
}