'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'

type ClaimProfileFormProps = {
  hikerId: number
  profileName: string | null
  onSuccess?: () => void
  onCancel?: () => void
}

export default function ClaimProfileForm({
  hikerId,
  profileName,
  onSuccess,
  onCancel,
}: ClaimProfileFormProps) {
  const [message, setMessage] = useState('')
  const [socialLink, setSocialLink] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setSuccessMessage('')
    setErrorMessage('')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        setErrorMessage(
          'Bitte logge dich zuerst ein, um ein Profil zu beanspruchen.'
        )
        setSubmitting(false)
        return
      }

      if (!message.trim() || !proofFile) {
        setErrorMessage('Bitte fülle alle Pflichtfelder aus.')
        setSubmitting(false)
        return
      }

      const fileExt = proofFile.name.split('.').pop()?.toLowerCase() ?? 'file'
      const safeExt = fileExt.replace(/[^a-z0-9]/g, '') || 'file'
      const filePath = `claim-${hikerId}/${session.user.id}-${Date.now()}.${safeExt}`

      const { error: uploadError } = await supabase.storage
        .from('claim-proofs')
        .upload(filePath, proofFile, {
          upsert: false,
        })

      if (uploadError) {
        setErrorMessage('Der Nachweis konnte nicht hochgeladen werden.')
        setSubmitting(false)
        return
      }

      const { data: publicUrlData } = supabase.storage
        .from('claim-proofs')
        .getPublicUrl(filePath)

      const proofUrl = publicUrlData.publicUrl

      const { error } = await supabase.from('claim_requests').insert({
        hiker_id: hikerId,
        user_id: session.user.id,
        email: session.user.email ?? '',
        profile_name: profileName ?? '',
        message: message.trim(),
        social_link: socialLink.trim() || null,
        proof_url: proofUrl,
        status: 'pending',
      })

      if (error) {
        setErrorMessage('Deine Claim-Anfrage konnte nicht gesendet werden.')
        setSubmitting(false)
        return
      }

      setMessage('')
      setSocialLink('')
      setProofFile(null)
      setSuccessMessage('Deine Claim-Anfrage wurde erfolgreich gesendet.')

      if (onSuccess) {
        onSuccess()
      }
    } catch (_error) {
      setErrorMessage('Beim Senden ist ein Fehler aufgetreten.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/10">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-white">Profil beanspruchen</h3>
        <p className="mt-1 text-sm text-stone-400">
          Wenn dieses Profil dir gehört, kannst du hier eine Claim-Anfrage
          senden.
        </p>
        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-stone-500">
          * Pflichtfelder
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-stone-200">
            Profilname *
          </label>
          <input
            type="text"
            value={profileName ?? ''}
            disabled
            className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-stone-300 outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-stone-200">
            Woran erkennen wir, dass dieses Profil dir gehört? *
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Zum Beispiel: Eventname, Ergebnisliste, Startnummer oder anderer überprüfbarer Bezug."
            rows={4}
            className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none transition placeholder:text-stone-500 focus:border-white/20 focus:bg-black/20"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-stone-200">
            Nachweis hochladen *
          </label>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null
              setProofFile(file)
            }}
            className="block w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-stone-300 file:mr-4 file:rounded-xl file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-white/15"
          />
          <p className="mt-2 text-xs text-stone-500">
            Erlaubt: JPG, PNG, WEBP oder PDF
          </p>
          {proofFile ? (
            <p className="mt-2 text-sm text-stone-300">
              Ausgewählt: {proofFile.name}
            </p>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-stone-200">
            Social Link
          </label>
          <input
            type="url"
            value={socialLink}
            onChange={(e) => setSocialLink(e.target.value)}
            placeholder="Optional: Instagram, Strava oder anderes Profil"
            className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none transition placeholder:text-stone-500 focus:border-white/20 focus:bg-black/20"
          />
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
            {successMessage}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-stone-100 transition hover:-translate-y-0.5 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Wird gesendet…' : 'Claim-Anfrage senden'}
          </button>

          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-2xl border border-white/10 bg-transparent px-5 py-3 text-sm font-medium text-stone-300 transition hover:bg-white/[0.04] hover:text-white"
            >
              Abbrechen
            </button>
          ) : null}
        </div>
      </form>
    </div>
  )
}