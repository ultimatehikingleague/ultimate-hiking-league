'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'

type RecordVisibilityToggleProps = {
  recordId: number
  initialIsPublic: boolean
}

export default function RecordVisibilityToggle({
  recordId,
  initialIsPublic,
}: RecordVisibilityToggleProps) {
  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleToggle() {
    if (saving) return

    const nextValue = !isPublic

    setSaving(true)
    setErrorMessage('')

    const { error } = await supabase
      .from('records')
      .update({
        is_public: nextValue,
      })
      .eq('id', recordId)

    if (error) {
      setErrorMessage('Sichtbarkeit konnte nicht geändert werden.')
      setSaving(false)
      return
    }

    setIsPublic(nextValue)
    setSaving(false)
  }

  return (
    <div className="mt-3">
      <div className="inline-flex items-center gap-3">
        <span className="text-xs text-stone-400">
          {isPublic ? 'Öffentlich sichtbar' : 'Nur für mich sichtbar'}
        </span>

        <button
          type="button"
          onClick={handleToggle}
          disabled={saving}
          aria-pressed={isPublic}
          aria-label="Sichtbarkeit ändern"
          className="relative shrink-0 rounded-full transition-all duration-200 disabled:opacity-50"
          style={{
            width: '52px',
            height: '30px',
            minWidth: '52px',
            padding: 0,
            backgroundColor: isPublic
              ? 'rgb(16 185 129)'
              : 'rgb(82 82 91)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <span
            className="absolute rounded-full bg-white shadow-md transition-all duration-200"
            style={{
              width: '24px',
              height: '24px',
              top: '2px',
              left: isPublic ? '25px' : '2px',
            }}
          />
        </button>

        {saving ? (
          <span className="text-xs text-stone-600">
            Speichert…
          </span>
        ) : null}
      </div>

      {errorMessage ? (
        <div className="mt-1 text-xs text-red-300">
          {errorMessage}
        </div>
      ) : null}
    </div>
  )
}