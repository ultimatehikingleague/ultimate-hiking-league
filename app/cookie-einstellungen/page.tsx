'use client'

import { useTranslations } from 'next-intl'

export default function CookieSettingsPage() {
  const t = useTranslations('cookieSettings')
  function resetConsent() {
    localStorage.removeItem('uhl_cookie_consent')
    window.location.href = '/'
  }

  return (
    <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold text-white md:text-5xl">
          {t('title')}
        </h1>

        <p className="mt-4 text-stone-400 leading-7">
          {t('intro')}
        </p>

        <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8">
          <button
            onClick={resetConsent}
            className="rounded-2xl bg-stone-100 px-6 py-4 text-sm font-medium text-stone-950 transition hover:bg-white"
          >
            {t('reset')}
          </button>

          <p className="mt-4 text-sm text-stone-500">
            {t('reappears')}
          </p>
        </div>
      </div>
    </main>
  )
}