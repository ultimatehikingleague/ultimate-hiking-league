import { useTranslations } from 'next-intl'
import Link from '@/i18n/prototype/LocalizedLink'

export default function FAQPage() {
  const t = useTranslations('faq')
  const rules = useTranslations('leagueRules')
  const ui = useTranslations('ui')
  return (
    <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
      <div className="mx-auto max-w-3xl">

        {/* Zurück Button */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-block rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-stone-200 transition hover:border-white/20 hover:bg-white/10"
          >
            {t('back')}
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-6">{ui('navFaqLabel')}</h1>

        <p className="mb-8 text-stone-400">
          {t('intro')}
        </p>

        <div className="space-y-6">

          <div>
            <h2 className="font-semibold text-lg">{t('costQuestion')}</h2>
            <p className="text-stone-400 mt-2">
              {t('costAnswer')}
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-lg">{t('whyLogQuestion')}</h2>
            <p className="text-stone-400 mt-2">
              {t('whyLogAnswer')}
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-lg">{t('comparisonQuestion')}</h2>
            <p className="text-stone-400 mt-2">
              {t('comparisonAnswer')}
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-lg">{t('displayNameQuestion')}</h2>
            <p className="text-stone-400 mt-2">
              {t('displayNameAnswer')}
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-lg">{t('gpxQuestion')}</h2>
            <p className="text-stone-400 mt-2">
              {t('gpxAnswer')}
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-lg">{t('eventsQuestion')}</h2>
            <p className="text-stone-400 mt-2">
              {t('eventsAnswer')}
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-lg">{t('trackingQuestion')}</h2>
            <p className="text-stone-400 mt-2">
              {t('trackingAnswer')}
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-lg">{t('garminQuestion')}</h2>
            <p className="text-stone-400 mt-2">
              {t('garminAnswer')}
            </p>
            <p className="text-stone-400 mt-2">{t('garminSteps')}</p>
            <ol className="text-stone-400 mt-2 list-decimal space-y-1 pl-6">
              <li>{t('signIn')}</li>
              <li>{t('connect')}</li>
              <li>{t('sync')}</li>
              <li>{t('import')}</li>
              <li>{t('check')}</li>
              <li>{t('publish')}</li>
            </ol>
            <p className="text-stone-400 mt-2">
              {rules('garminPrivateVerification')}{' '}
              {rules('garminEventApproval')}{' '}
              {rules('garminConnection')}
            </p>
            <p className="text-stone-400 mt-2">{t('note')}</p>
            <ul className="text-stone-400 mt-2 list-disc space-y-1 pl-6">
              <li>{t('onlyNewGarminActivities')}</li>
              <li>{t('garminThresholds')}</li>
              <li>{t('garminMetrics')}</li>
              <li>{t('disconnect')}</li>
            </ul>
          </div>

          <div>
            <h2 className="font-semibold text-lg">
              {t('timeQuestion')}
            </h2>
            <p className="text-stone-400 mt-2">
              {t('timeOverview')}
            </p>
            <p className="text-stone-400 mt-2">
              {t('timeBreaks')}
            </p>
            <p className="text-stone-400 mt-2">
              {t('movingTime')}
            </p>
            <p className="text-stone-400 mt-2">
              {t('timeRule')}
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-lg">{t('secondsQuestion')}</h2>
            <p className="text-stone-400 mt-2">
              {t('secondsAnswer')}
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-lg">{t('reviewQuestion')}</h2>
            <p className="text-stone-400 mt-2">
              {t('reviewAnswer')}
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-lg">{t('pastQuestion')}</h2>
            <p className="text-stone-400 mt-2">
              {t('pastAnswer')}
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-lg">{t('timelineQuestion')}</h2>
            <p className="text-stone-400 mt-2">
              {t('timelineAnswer')}
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-lg">{t('otherAppsQuestion')}</h2>
            <p className="text-stone-400 mt-2">
              {t('otherAppsAnswer')}
            </p>
          </div>

        </div>
      </div>
    </main>
  )
}