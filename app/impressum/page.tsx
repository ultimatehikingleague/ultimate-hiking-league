import { useTranslations } from 'next-intl'
export default function ImpressumPage() {
  const t = useTranslations('imprint')
  return (
    <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-white">{t('title')}</h1>

        <div className="mt-6 space-y-4 text-sm text-stone-300 leading-6">
          <p>{t('statute')}</p>

          <p>
            Ultimate Hiking League<br />
            Philipp Dobrinski<br />
            Ansbacher Straße 4a<br />
            91452 Wilhermsdorf<br />
            {t('country')}
          </p>

          <p>
            {t('email')}
          </p>

          <p>
            {t('responsible')}
          </p>

          <p>
            Philipp Dobrinski<br />
            {t('address')}
          </p>
        </div>
      </div>
    </main>
  )
}