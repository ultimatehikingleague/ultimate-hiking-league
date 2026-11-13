'use client'

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { supabase } from '../../../lib/supabase'
import { httpsUrl } from '../../../lib/shop/merchandise'
import {
  managedImagePath, maxProductImageBytes, maxProductImages, moveProductImage, productImageTypes,
} from '../../../lib/shop/product-images'

export type ProductImage = { id: string; url?: string; file?: File }
const endpoint = '/api/admin/shop/products/images'
const control = 'rounded-md border border-white/20 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-40'

export async function uploadProductImage(
  file: File, sku: string, token: string, progress: (percent: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', endpoint)
    request.setRequestHeader('Authorization', 'Bearer ' + token)
    request.responseType = 'json'
    request.timeout = 90_000
    request.upload.onprogress = event => {
      if (event.lengthComputable) progress(Math.min(100, Math.round(event.loaded / event.total * 100)))
    }
    request.onload = () => {
      if (request.status === 201 && typeof request.response?.url === 'string') resolve(request.response.url)
      else reject(new Error(request.response?.error || 'Das Bild konnte nicht hochgeladen werden.'))
    }
    request.onerror = request.ontimeout = () => reject(new Error('Der Upload wurde unterbrochen. Bitte erneut versuchen.'))
    const form = new FormData()
    form.set('sku', sku)
    form.set('image', file)
    request.send(form)
  })
}

function Preview({ image, signedUrl, index }: { image: ProductImage; signedUrl?: string; index: number }) {
  const [failedSrc, setFailedSrc] = useState('')
  const file = image.file
  const localPreview = useCallback((node: HTMLImageElement | null) => {
    if (!node || !file) return
    const url = URL.createObjectURL(file)
    node.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])
  const src = signedUrl || (image.url && !managedImagePath(image.url) ? image.url : '')
  const sourceKey = file ? image.id : src
  if ((!file && !src) || failedSrc === sourceKey) {
    return <div className="grid aspect-square place-items-center p-3 text-center text-sm text-stone-400">
      {sourceKey ? 'Vorschau nicht verfügbar' : 'Vorschau wird geladen …'}
    </div>
  }
  // External HTTPS URLs and local object URLs are used directly in the editor.
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={localPreview} src={file ? undefined : src} alt={'Produktbild ' + (index + 1)} loading="lazy"
    referrerPolicy="no-referrer" className="aspect-square w-full object-contain"
    onError={() => setFailedSrc(sourceKey)} />
}

export default function ProductImages({ images, onChange, busy, progress }: {
  images: ProductImage[]
  onChange: (images: ProductImage[]) => void
  busy: boolean
  progress: { index: number; total: number; percent: number } | null
}) {
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [link, setLink] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const replaceInput = useRef<HTMLInputElement>(null)
  const replacing = useRef<string | null>(null)
  const dragging = useRef<number | null>(null)
  const managed = JSON.stringify([...new Set(images.flatMap(image =>
    image.url && !image.file && managedImagePath(image.url) ? [image.url] : []))].sort())

  useEffect(() => {
    const urls: string[] = JSON.parse(managed)
    if (!urls.length) return
    const controller = new AbortController()
    async function load() {
      try {
        const { data } = await supabase.auth.getSession()
        if (!data.session) throw Error()
        const response = await fetch(endpoint, {
          method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session.access_token },
          body: JSON.stringify({ urls }),
        })
        if (!response.ok) throw Error()
        if (!controller.signal.aborted) {
          const result = (await response.json()).previews as Record<string, string>
          setPreviews(result)
          setPreviewError(urls.some(url => !result[url]) ? 'Mindestens eine gespeicherte Vorschau ist nicht verfügbar.' : '')
        }
      } catch {
        if (!controller.signal.aborted) setPreviewError('Gespeicherte Vorschauen konnten nicht geladen werden.')
      }
    }
    void load()
    return () => controller.abort()
  }, [managed])

  function addFiles(files: FileList | null, replacement?: string | null) {
    if (!files?.length || busy) return
    const accepted: ProductImage[] = []
    const errors: string[] = []
    const capacity = replacement ? 1 : maxProductImages - images.length
    for (const file of Array.from(files)) {
      if (!file.size || (file.type && !productImageTypes.includes(file.type))) errors.push(file.name + ' · Bitte JPG, PNG oder WebP verwenden.')
      else if (file.size > maxProductImageBytes) errors.push(file.name + ' · Höchstens 4 MB pro Bild.')
      else if (accepted.length >= capacity) {
        errors.push('Es sind höchstens ' + maxProductImages + ' Produktbilder möglich.')
        break
      } else accepted.push({ id: crypto.randomUUID(), file })
    }
    if (accepted.length) onChange(replacement
      ? images.map(image => image.id === replacement ? accepted[0] : image)
      : [...images, ...accepted])
    setMessage(errors.join(' '))
  }

  function select(event: ChangeEvent<HTMLInputElement>, replace = false) {
    addFiles(event.target.files, replace ? replacing.current : null)
    event.target.value = ''
  }

  function addLink() {
    const url = httpsUrl(link.trim())
    if (!url || images.length >= maxProductImages) {
      setMessage(url ? 'Es sind höchstens 12 Produktbilder möglich.' : 'Bitte eine gültige HTTPS-Bildadresse eingeben.')
      return
    }
    onChange([...images, { id: crypto.randomUUID(), url }])
    setLink('')
    setMessage('')
  }

  return <fieldset disabled={busy} className="rounded-xl border border-white/15 bg-black/20 p-4 sm:col-span-2">
    <legend className="px-2 text-lg font-bold">Produktbilder</legend>
    <p className="text-sm text-stone-300">{images.length} von {maxProductImages} Bildern. Das erste Bild ist das Hauptbild. Änderungen werden mit dem Produkt gespeichert.</p>
    <input ref={fileInput} hidden type="file" accept={productImageTypes.join(',')} multiple onChange={select} />
    <input ref={replaceInput} hidden type="file" accept={productImageTypes.join(',')} onChange={event => select(event, true)} />
    <div className={'mt-4 rounded-lg border-2 border-dashed p-5 text-center ' + (dragOver ? 'border-emerald-300 bg-emerald-400/15' : 'border-white/20')}
      onDragOver={event => {
        if (!busy && event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDragOver(true) }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={event => { event.preventDefault(); setDragOver(false); addFiles(event.dataTransfer.files) }}>
      <p className="mb-2 text-sm">Bilder hierher ziehen · JPG, PNG oder WebP · bis zu 4 MB pro Datei</p>
      <button type="button" className={control} disabled={images.length >= maxProductImages} onClick={() => fileInput.current?.click()}>Bilder auswählen</button>
    </div>
    {progress && <div className="mt-3" role="status" aria-live="polite">
      <p>Bild {progress.index} von {progress.total} · {progress.percent === 100 ? 'Wird optimiert und gespeichert …' : progress.percent + ' % übertragen'}</p>
      <progress aria-label="Upload-Fortschritt" className="mt-1 w-full accent-emerald-400" value={progress.percent} max={100} />
    </div>}
    {(message || (managed !== '[]' && previewError)) && <p role="alert" className="mt-3 text-sm text-amber-200">{message || previewError}</p>}
    {!!images.length && <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {images.map((image, index) => <li key={image.id} draggable={!busy}
        onDragStart={event => { dragging.current = index; event.dataTransfer.setData('text/plain', image.id) }}
        onDragEnd={() => { dragging.current = null }}
        onDragOver={event => { if (!busy && dragging.current !== null) event.preventDefault() }}
        onDrop={event => {
          event.preventDefault()
          if (!busy && dragging.current !== null) onChange(moveProductImage(images, dragging.current, index))
          dragging.current = null
        }}
        className="overflow-hidden rounded-lg border border-white/15 bg-stone-900">
        <Preview image={image} signedUrl={image.url ? previews[image.url] : undefined} index={index} />
        <div className="space-y-2 p-3">
          <p className="truncate text-sm" title={image.file?.name}>{image.file?.name || 'Bild ' + (index + 1)}</p>
          {index === 0 ? <span className="inline-block rounded bg-emerald-400/20 px-2 py-1 text-sm font-semibold text-emerald-200">Hauptbild</span>
            : <button type="button" className={control} onClick={() => onChange(moveProductImage(images, index, 0))}>Als Hauptbild</button>}
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-label={'Bild ' + (index + 1) + ' nach vorne'} className={control} disabled={index === 0} onClick={() => onChange(moveProductImage(images, index, index - 1))}>↑</button>
            <button type="button" aria-label={'Bild ' + (index + 1) + ' nach hinten'} className={control} disabled={index === images.length - 1} onClick={() => onChange(moveProductImage(images, index, index + 1))}>↓</button>
            <button type="button" className={control} onClick={() => { replacing.current = image.id; replaceInput.current?.click() }}>Ersetzen</button>
            <button type="button" className={control} onClick={() => onChange(images.filter(other => other.id !== image.id))}>Entfernen</button>
          </div>
        </div>
      </li>)}
    </ol>}
    <details className="mt-4">
      <summary className="cursor-pointer text-sm underline">HTTPS-Bildadresse hinzufügen</summary>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-sm">Bildadresse
          <input type="text" inputMode="url" maxLength={2048} value={link}
            onChange={event => setLink(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addLink() } }}
            className="mt-1 block w-full rounded-md border border-white/20 bg-stone-900 px-3 py-2" />
        </label>
        <button type="button" className={control} onClick={addLink}>Hinzufügen</button>
      </div>
    </details>
  </fieldset>
}
