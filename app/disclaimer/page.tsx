import { useTranslations } from 'next-intl'
import Link from '@/i18n/prototype/LocalizedLink'

export default function DisclaimerPage() {
  const t = useTranslations('disclaimer')
  const ui = useTranslations('ui')
  return (
    <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
          {ui('disclaimerLabel')}
        </h1>

        <p className="mt-4 text-stone-400">
          {t('intro')}
        </p>

        <section className="mt-10 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-xl shadow-black/10">
          <div className="space-y-6 text-sm leading-7 text-stone-300">
            <p>
              {t('external')}
            </p>

            <p>
              {t('responsibility')}
            </p>

            <p>
              {t('review')}
            </p>

            <p>
              {t('removal')}
            </p>

            <p>
              {t('profiles')}
            </p>
          </div>
        </section>
        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8">
          <h2 className="text-2xl font-bold text-white">{t('internationalUse')}</h2>
          <p className="mt-4 text-sm leading-7 text-stone-300">{t('applicableLaw')}</p>
        </section>
        {process.env.NODE_ENV !== 'production' && (
        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8">
          <h2 className="text-2xl font-bold text-white">{t('milestone')}</h2>
          <div className="mt-4 space-y-4 text-sm leading-7 text-stone-300">
            <p>{t('retailer')}</p>
            <p>{t('support')}</p>
            <p>{t('rulesLead')} <Link href="/milestone-shop/regeln" className="text-white underline underline-offset-4">{t('rulesLink')}</Link>.</p>
          </div>
        </section>
        )}
      </div>
    </main>
  );
}