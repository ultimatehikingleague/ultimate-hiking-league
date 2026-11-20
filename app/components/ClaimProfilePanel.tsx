'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import ClaimProfileForm from './ClaimProfileForm'

type ClaimProfilePanelProps = {
  hikerId: number
  profileName: string | null
}

export default function ClaimProfilePanel({
  hikerId,
  profileName,
}: ClaimProfilePanelProps) {
  const t = useTranslations('claimProfile')
  const [open, setOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  function handleSuccess() {
    setSubmitted(true)
    setOpen(false)
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-4 text-sm text-emerald-200">
        <div className="font-medium">{t('sent')}</div>
        <div className="mt-1 text-xs text-emerald-300/80">
          {t('review')}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full md:w-[340px]">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-left text-sm font-medium text-stone-100 transition hover:-translate-y-0.5 hover:bg-white/10"
        >
          <div>{t('yourProfile')}</div>
          <div className="text-xs text-stone-400">{t('claimNow')}</div>
        </button>
      ) : (
        <ClaimProfileForm
          hikerId={hikerId}
          profileName={profileName}
          onSuccess={handleSuccess}
          onCancel={() => setOpen(false)}
        />
      )}
    </div>
  )
}