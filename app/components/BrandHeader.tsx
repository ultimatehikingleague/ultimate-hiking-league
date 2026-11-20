'use client'

import { useTranslations } from 'next-intl'
import Image from 'next/image'
import Link from '@/i18n/prototype/LocalizedLink'

export default function BrandHeader() {
  const t = useTranslations('ui')
  return (
    <div className="mb-10 flex flex-col items-center text-center">
      <Link href="/" className="group inline-flex min-w-0 max-w-full flex-col items-center [overflow-wrap:anywhere]">
        <Image
          src="/ultimate-logo-transparent-weiss.png"
          alt={t('brandLogoAlt')}
          width={190}
          height={190}
          className="h-auto w-[120px] opacity-95 transition duration-300 group-hover:opacity-100 md:w-[160px]"
          priority
        />

        <div lang="en" translate="no" className="notranslate mt-5 text-[11px] font-semibold uppercase tracking-[0.42em] text-stone-300 md:text-[13px]">
          Ultimate European Hiking League
        </div>

        <div lang="en" translate="no" className="notranslate mt-3 text-3xl font-bold tracking-tight text-white md:text-5xl">
          Show us who you are.
        </div>

        <div className="mt-3 text-base text-stone-300 md:text-lg">{t("leagueTagline")}</div>
      </Link>
    </div>
  )
}