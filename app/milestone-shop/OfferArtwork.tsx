'use client'

import { useState } from 'react'

// Assign across the full ordered catalogue so filtering or paging never changes a card's artwork.
export function offerLandscapes(offers: readonly { id: number }[]) {
  const landscapes = new Map<number, number>()
  let previous = 0
  for (const offer of offers) {
    const preferred = offer.id % 4 + 1
    const landscape = preferred === previous ? preferred % 4 + 1 : preferred
    landscapes.set(offer.id, landscape)
    previous = landscape
  }
  return landscapes
}

export default function OfferArtwork({ landscape, image, label, variant, cover = false }: {
  cover?: boolean
  landscape: number
  image: string | null
  label: string
  variant: 'discount' | 'ticket' | 'free' | 'product'
}) {
  const [failedImage, setFailedImage] = useState<string | null>(null)

  return (
    <div className="milestone-artwork" style={{ backgroundImage: `linear-gradient(#04142136, #04142170), url(/images/milestone-shop/landscape-${landscape}.webp)` }}>
      <span className="milestone-label" data-variant={variant}>{label}</span>
      {image && failedImage !== image && (
        // The catalog supplies both remote logos and product covers.
        // eslint-disable-next-line @next/next/no-img-element
        <img data-cover={cover || undefined} src={image} alt="" loading="lazy" onError={() => setFailedImage(image)} />
      )}
    </div>
  )
}
