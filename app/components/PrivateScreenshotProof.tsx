'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { screenshotBucket } from '../lib/activity/screenshot-proof'

export default function PrivateScreenshotProof({ path, index }: { path: string; index: number }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function download() {
    setBusy(true)
    setFailed(false)
    try {
      const { data, error } = await supabase.storage.from(screenshotBucket).download(path)
      if (error || !data) throw error ?? Error('Nachweis fehlt.')
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = `Original-Screenshot-${index + 1}.${path.split('.').at(-1)}`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return <div>
    <button type="button" onClick={download} disabled={busy} className="text-sm text-white underline">
      Original-Screenshot {index + 1} herunterladen
    </button>
    {failed && <p role="alert" className="text-sm text-amber-200">Der Nachweis konnte nicht geladen werden.</p>}
  </div>
}
