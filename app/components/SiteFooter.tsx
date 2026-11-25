'use client'

import { useLocale, useTranslations } from 'next-intl'
import Link from '@/i18n/prototype/LocalizedLink'
import { usePathname } from 'next/navigation'
import { splitLanguagePath } from '../../i18n/public-paths'
import { LiveBrandPlacement, MilestonePartners } from './PartnerPlacements'
import PartnershipFooter from './PartnershipFooter'

const legalLinks = [
  ['/impressum', 'legalNotice'], ['/datenschutz', 'privacy'],
  ['/disclaimer', 'Disclaimer'], ['/kontakt', 'contact'],
  ['/cookie-einstellungen', 'cookieSettings'], ['/shop/widerruf', 'withdrawalPolicy'],
  ['/shop/widerruf/erklaeren', 'withdrawContract'],
] as const

function FooterSocialLinks() {
  const linkStyle = 'inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-stone-400 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

  return (
    <div className="flex shrink-0 items-center gap-2">
      <a
        href="https://www.instagram.com/ultimatehikingleague/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Ultimate Hiking League · Instagram"
        className={linkStyle}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      </a>
      <a
        href="https://www.facebook.com/profile.php?id=61576492481733"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Ultimate Hiking League · Facebook"
        className={linkStyle}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M14 22v-9h3l.5-4H14V7c0-1 .3-2 2-2h2V2.3c-.8-.2-1.8-.3-3-.3-3 0-5 1.8-5 5v2H7v4h3v9z" />
        </svg>
      </a>
    </div>
  )
}

export default function SiteFooter() {
  const t = useTranslations('ui')
  const locale = useLocale()
  const currentPath = usePathname()
  const pathname = splitLanguagePath(currentPath)?.pathname ?? currentPath
  const milestone = pathname === '/milestone-shop' || pathname.startsWith('/milestone-shop/') || pathname === '/account/rewards' || pathname === '/admin/milestone-shop/vorschau'
  const leaguePage = pathname !== '/shop' && !pathname.startsWith('/shop/') && !pathname.startsWith('/admin')
  if (!milestone) return <>
          <PartnershipFooter />
          {leaguePage && <MilestonePartners />}

         <footer className="border-t border-white/10 px-6 py-6 text-sm text-stone-500">
            <div className="mx-auto max-w-6xl">
              {leaguePage &&
                <LiveBrandPlacement surface="footer" />}
              <div className="flex flex-wrap items-center gap-6">
                <Link href="/shop/bestellinformationen" className="hover:text-white transition">{t("orderInfo")}</Link>
                <Link href="/shop/widerruf" className="hover:text-white transition">{t("withdrawalPolicy")}</Link>
                <Link href="/shop/widerruf/erklaeren" className="hover:text-white transition">{t("withdrawContract")}</Link>
                <Link href="/impressum" className="hover:text-white transition">{t("legalNotice")}</Link>
                <Link href="/datenschutz" className="hover:text-white transition">{t("privacy")}</Link>
                <Link href="/kontakt" className="hover:text-white transition">{t("contact")}</Link>
                <Link href="/disclaimer" className="hover:text-white transition">
                  {t('disclaimerLabel')}
                </Link>
                <Link href="/cookie-einstellungen" className="hover:text-white transition">{t("cookieSettings")}</Link>
                {!pathname.startsWith('/admin') && !pathname.startsWith('/account') && <FooterSocialLinks />}
              </div>
            </div>
          </footer>
  </>
  return <footer lang={locale} className="border-t border-white/10 bg-[#080d16] px-6 py-10 text-slate-400 md:px-10">
    <div className="mx-auto max-w-7xl">
      <p className="text-sm font-bold tracking-wider text-white">ULTIMATE MILESTONE SHOP</p>
      <p className="mt-4 max-w-3xl text-sm leading-6">{t('milestoneFooterNotice')}</p>
      <nav aria-label={t('milestoneFooterNavigation')} className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm">
        <Link href="/milestone-shop/regeln" className="font-semibold text-cyan-300 hover:text-white">{t('milestoneFooterRules')}</Link>
        {legalLinks.map(([href, label]) => <Link key={href} href={href} className="hover:text-white">{label === 'Disclaimer' ? t('disclaimerLabel') : t(label)}</Link>)}
      </nav>
      {pathname !== '/account/rewards' && <div className="mt-4"><FooterSocialLinks /></div>}
      <p className="mt-6 text-xs">© {new Date().getFullYear()} ULTIMATE HIKING LEAGUE</p>
    </div>
  </footer>
}
