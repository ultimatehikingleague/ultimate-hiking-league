'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react'

type ProductGalleryProps = {
  images: {
    src: string
    alt: string
  }[]
}

export default function ProductGallery({ images }: ProductGalleryProps) {
  const t = useTranslations('productGallery')
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const activeImage = images[activeIndex]

  const previousImage = () => {
    setActiveIndex((current) =>
      current === 0 ? images.length - 1 : current - 1
    )
  }

  const nextImage = () => {
    setActiveIndex((current) =>
      current === images.length - 1 ? 0 : current + 1
    )
  }

  useEffect(() => {
    if (!lightboxOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightboxOpen(false)
      }

      if (event.key === 'ArrowLeft') {
        setActiveIndex((current) =>
          current === 0 ? images.length - 1 : current - 1
        )
      }

      if (event.key === 'ArrowRight') {
        setActiveIndex((current) =>
          current === images.length - 1 ? 0 : current + 1
        )
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [lightboxOpen, images.length])

  if (!images.length || !activeImage) {
    return null
  }

  return (
    <div className="w-full">

      {/* HAUPTBILD */}
      <div className="relative flex min-h-[420px] items-center justify-center rounded-lg bg-[#E9E5DC] p-6 md:min-h-[570px] md:p-10">

        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="group relative flex items-center justify-center"
          aria-label={t('zoom')}
        >
          <img
            src={activeImage.src}
            alt={activeImage.alt}
            className="max-h-[500px] w-auto max-w-full object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.20)] transition-transform duration-300 group-hover:scale-[1.02]"
          />

          <span className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-md bg-white/90 text-[#244B36] shadow-md">
            <Expand size={19} />
          </span>
        </button>

      </div>

      {/* VORSCHAUBILDER */}
      <div className="mt-5 grid grid-cols-4 gap-3 sm:grid-cols-5 lg:grid-cols-7">

        {images.map((image, index) => (
          <button
            key={image.src}
            type="button"
            onClick={() => {
              setActiveIndex(index)
              setLightboxOpen(true)
            }}
            className={`flex aspect-square items-center justify-center overflow-hidden rounded-md border-2 bg-[#E9E5DC] p-2 transition ${
              activeIndex === index
                ? 'border-[#244B36]'
                : 'border-transparent hover:border-[#A9C68B]'
            }`}
            aria-label={t('enlargeImage', { number: index + 1 })}
          >
            <img
              src={image.src}
              alt={image.alt}
              className="h-full w-full object-contain"
            />
          </button>
        ))}

      </div>

      <p className="mt-4 text-center text-xs text-[#777B73]">
        {t('image')} {activeIndex + 1} {t('of')} {images.length} {t('clickToZoom')}
      </p>

      {/* LIGHTBOX */}
      {lightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('products')}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 p-4"
          onClick={() => setLightboxOpen(false)}
        >

          {/* SCHLIESSEN */}
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute right-5 top-5 z-20 flex h-12 w-12 items-center justify-center rounded-md bg-white/10 text-white transition hover:bg-white/20"
            aria-label={t('close')}
          >
            <X size={26} />
          </button>

          {/* VORHERIGES BILD */}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              previousImage()
            }}
            className="absolute left-3 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-md bg-white/10 text-white transition hover:bg-white/20 md:left-8"
            aria-label={t('previous')}
          >
            <ChevronLeft size={30} />
          </button>

          {/* VERGRÖSSERTES BILD */}
          <div
            className="flex h-full w-full items-center justify-center px-12 py-16 md:px-24"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={activeImage.src}
              alt={activeImage.alt}
              className="max-h-full max-w-full object-contain"
            />
          </div>

          {/* NÄCHSTES BILD */}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              nextImage()
            }}
            className="absolute right-3 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-md bg-white/10 text-white transition hover:bg-white/20 md:right-8"
            aria-label={t('next')}
          >
            <ChevronRight size={30} />
          </button>

          {/* BILDZÄHLER */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-md bg-white/10 px-5 py-2 text-sm font-medium text-white">
            {activeIndex + 1} / {images.length}
          </div>

        </div>
      )}

    </div>
  )
}