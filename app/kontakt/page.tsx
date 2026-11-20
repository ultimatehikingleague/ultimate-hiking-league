import { useTranslations } from 'next-intl'
export default function KontaktPage() {
  const t = useTranslations('contact')
  const ui = useTranslations('ui')
  return (
    <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-white">{t('title')}</h1>

        <div className="mt-6 space-y-5 text-sm leading-6 text-stone-300">
          <p>
            {t('intro')}
          </p>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
              {ui('contactLabel')}
            </div>
            <div className="mt-3 text-base font-medium text-white">
              ultimatehikingleague@gmail.com
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
              {t('postalAddress')}
            </div>
            <div className="mt-3">
              Ultimate Hiking League<br />
              Philipp Dobrinski<br />
              Ansbacher Straße 4a<br />
              91452 Wilhermsdorf<br />
              {t('germany')}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}