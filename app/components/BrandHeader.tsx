'use client'

import Image from 'next/image'
import Link from 'next/link'

export default function BrandHeader() {
  return (
    <div className="mb-10 flex flex-col items-center text-center">
      <Link href="/" className="group inline-flex flex-col items-center">
        <Image
          src="/ultimate-logo-transparent-weiss.png"
          alt="Ultimate European Hiking League Logo"
          width={190}
          height={190}
          className="h-auto w-[120px] opacity-95 transition duration-300 group-hover:opacity-100 md:w-[160px]"
          priority
        />

        <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.42em] text-stone-300 md:text-[13px]">
          Ultimate European Hiking League
        </div>

        <div className="mt-3 text-3xl font-bold tracking-tight text-white md:text-5xl">
          Show us who you are.
        </div>

        <div className="mt-3 text-base text-stone-300 md:text-lg">
          Europas Liga für echte Hiker!
        </div>
      </Link>
    </div>
  )
}