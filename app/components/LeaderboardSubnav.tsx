'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  {
    href: '/leaderboard/overall',
    label: 'Overall',
  },
  {
    href: '/leaderboard/country',
    label: 'Country',
  },
  {
    href: '/skyscraper',
    label: 'Skyscraper',
  },
]

export default function LeaderboardSubnav() {
  const pathname = usePathname()

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      {items.map((item) => {
        const active = pathname === item.href

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex rounded-full px-4 py-2 text-sm transition ${
              active
                ? 'bg-white text-black'
                : 'border border-white/10 bg-white/[0.04] text-stone-200 hover:border-white/20 hover:bg-white/[0.06]'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}