'use client'

import { useState } from 'react'

export default function OfferArtwork({ id, image, label, variant }: {
  id: number
  image: string | null
  label: string
  variant: 'discount' | 'ticket' | 'free' | 'product'
}) {
  const [failedImage, setFailedImage] = useState<string | null>(null)
  const landscape = ((id % 4) + 4) % 4 + 1

  return (
    <div className="milestone-artwork" style={{ backgroundImage: `linear-gradient(#04142136, #04142170), url(/images/milestone-shop/landscape-${landscape}.webp)` }}>
      <span className="milestone-label" data-variant={variant}>{label}</span>
      {image && failedImage !== image && (
        // The catalog supplies both remote logos and product covers.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" loading="lazy" onError={() => setFailedImage(image)} />
      )}
    </div>
  )
}
