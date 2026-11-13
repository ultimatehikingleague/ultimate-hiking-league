'use client'

import { useRef, useState } from 'react'
import { isScreenshotImage } from '../lib/activity/screenshot-proof'
import { type readScreenshotValues, screenshotLabels, type ScreenshotField, type ScreenshotValues } from '../lib/activity/screenshot'

export default function ActivityScreenshotImport({ disabled, onConfirm, onChange }: {
  disabled: boolean
  onChange: (hasFiles: boolean) => void
  onConfirm: (files: File[], values: ScreenshotValues) => void
}) {
  const active = useRef(false)
  const [files, setFiles] = useState<File[]>([])
  const [result, setResult] = useState<ReturnType<typeof readScreenshotValues>>()
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function recognize(selected: File[]) {
    if (active.current || disabled) return
    setError('')
    if (selected.length > 4 || selected.some(file => !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || !file.size || file.size > 8 * 1024 * 1024)) {
      setError('Bitte 1 bis 4 Screenshots als PNG, JPG oder WebP mit jeweils höchstens 8 MB wählen.')
      return
    }
    active.current = true
    setBusy(true)
    try {
      if (!(await Promise.all(selected.map(isScreenshotImage))).every(Boolean)) {
        setError('Mindestens eine Datei hat kein gültiges PNG-, JPG- oder WebP-Format.')
        return
      }
      onChange(selected.length > 0)
      setConfirmed(false)
      setFiles(selected)
      setResult(undefined)
      if (!selected.length) return
      const { createWorker } = await import('tesseract.js')
      const { recognizeGarminScreenshots } = await import('../lib/activity/garmin-ocr')
      const assetUrl = new URL('/activity-ocr/', window.location.origin)
      const worker = await createWorker(['deu', 'eng'], 1, {
        workerPath: new URL('worker.min.js', assetUrl).href,
        corePath: new URL('tesseract-core-lstm.wasm.js', assetUrl).href,
        langPath: assetUrl.href,
      })
      try {
        await worker.setParameters({ preserve_interword_spaces: '1' })
        setResult(await recognizeGarminScreenshots(worker, selected))
      } finally {
        await worker.terminate()
      }
    } catch {
      setError('Texterkennung fehlgeschlagen. Du kannst die Bilder als Nachweis übernehmen und die Werte selbst eintragen.')
    } finally {
      setBusy(false)
      active.current = false
    }
  }

  return <section className="mb-5 space-y-4 rounded-2xl border border-emerald-200/30 bg-stone-950 p-4 sm:p-5">
    <label className="block font-semibold text-white">
      Screenshot auswählen
      <input type="file" multiple accept="image/png,image/jpeg,image/webp" disabled={disabled || busy}
        className="mt-3 block w-full text-sm text-stone-300 file:mr-3 file:rounded-xl file:border-0 file:bg-emerald-200 file:px-3 file:py-3 file:text-emerald-950"
        onChange={event => {
          const selected = Array.from(event.target.files ?? [])
          event.target.value = ''
          if (selected.length) void recognize(selected)
        }} />
    </label>
    <p className="text-sm text-stone-300">Die Bilder werden hier im Browser gelesen und beim Einreichen als Originalnachweis verwendet.</p>
    {files.length > 0 && <ul className="break-all text-sm text-stone-300">{files.map((file, index) => <li key={index} className="flex flex-wrap items-center gap-x-3">
      <span>{file.name}</span>
      <button type="button" className="min-h-11 underline" disabled={disabled || busy}
        onClick={() => void recognize(files.filter((_, position) => position !== index))}>Entfernen</button>
    </li>)}</ul>}
    {busy && <p role="status">Screenshots werden gelesen …</p>}
    {error && <p role="alert" className="text-amber-200">{error}</p>}
    {result && <div aria-live="polite">
      <h4 className="mb-2 font-semibold">Erkannte Daten prüfen</h4>
      <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 text-sm">
        {(['distance', 'elapsed', 'ascent', 'title'] satisfies ScreenshotField[]).map(field => <div key={field} className="rounded-lg bg-stone-800 p-2">
          <dt className="text-stone-300">{screenshotLabels[field]}</dt>
          <dd className="break-words">{result.values[field] ?? (result.conflicts.includes(field) ? 'Widersprüchlich' : 'Offen')}</dd>
        </div>)}
      </dl>
      <p className="mt-2 text-sm text-stone-300">Das Datum ergänzt du im Formular.</p>
    </div>}
    {!busy && files.length > 0 && <button type="button" disabled={disabled || confirmed}
      className="min-h-12 rounded-xl bg-emerald-200 px-4 py-2 font-semibold text-emerald-950"
      onClick={() => {
        const { distance, elapsed, ascent, title } = result?.values ?? {}
        setConfirmed(true)
        onConfirm(files, { distance, elapsed, ascent, title })
      }}>{confirmed ? 'Werte und Nachweise übernommen' : 'Werte und Nachweise übernehmen'}</button>}
  </section>
}
