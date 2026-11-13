'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import PartnershipFooter from './PartnershipFooter'

const legalLinks = [
  ['/impressum', 'Impressum'], ['/datenschutz', 'Datenschutz'],
  ['/disclaimer', 'Disclaimer'], ['/kontakt', 'Kontakt'],
  ['/cookie-einstellungen', 'Cookie-Einstellungen'],
  ['/shop/widerruf', 'Widerrufsbelehrung'],
  ['/shop/widerruf/erklaeren', 'Vertrag widerrufen'],
]

export default function SiteFooter() {
  const pathname = usePathname()
  const milestone = pathname === '/milestone-shop' || pathname.startsWith('/milestone-shop/') || pathname === '/account/rewards'
  if (!milestone) return <>
          <PartnershipFooter />

         <footer className="border-t border-white/10 px-6 py-6 text-sm text-stone-500">
            <div className="mx-auto max-w-6xl">
              <div className="flex flex-wrap items-center gap-6">
                <Link href="/shop/bestellinformationen" className="hover:text-white transition">Bestellinformationen</Link>
                <Link href="/shop/widerruf" className="hover:text-white transition">Widerrufsbelehrung</Link>
                <Link href="/shop/widerruf/erklaeren" className="hover:text-white transition">Vertrag widerrufen</Link>
                <Link href="/impressum" className="hover:text-white transition">
                  Impressum
                </Link>
                <Link href="/datenschutz" className="hover:text-white transition">
                  Datenschutz
                </Link>
                <Link href="/kontakt" className="hover:text-white transition">
                  Kontakt
                </Link>
                <Link href="/disclaimer" className="hover:text-white transition">
                  Disclaimer
                </Link>
                <Link href="/cookie-einstellungen" className="hover:text-white transition">
                  Cookie-Einstellungen
                </Link>
              </div>
            </div>
          </footer>
  </>
  return <footer className="border-t border-white/10 bg-[#080d16] px-6 py-10 text-slate-400 md:px-10">
    <div className="mx-auto max-w-7xl">
      <p className="text-sm font-bold tracking-wider text-white">ULTIMATE MILESTONE SHOP</p>
      <p className="mt-4 max-w-3xl text-sm leading-6">Die Einlösung der Partnercodes und die Erfüllung der angebotenen Händlerleistungen erfolgen durch den jeweils genannten Händler. ULTIMATE verwaltet Milestones und die Codezuteilung. Gesetzliche Ansprüche bleiben unberührt.</p>
      <nav aria-label="Milestone-Shop und rechtliche Hinweise" className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm">
        <Link href="/milestone-shop/regeln" className="font-semibold text-cyan-300 hover:text-white">Milestone-Regeln &amp; Einlösung</Link>
        {legalLinks.map(([href, label]) => <Link key={href} href={href} className="hover:text-white">{label}</Link>)}
      </nav>
      <p className="mt-6 text-xs">© {new Date().getFullYear()} ULTIMATE HIKING LEAGUE</p>
    </div>
  </footer>
}
