import { useTranslations } from 'next-intl'
import Link from '@/i18n/prototype/LocalizedLink'

export default function DatenschutzPage() {
  const t = useTranslations('privacy')
  return (
    <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-white md:text-4xl">
          {t('title')}
        </h1>

        <div className="mt-6 space-y-5 text-sm leading-7 text-stone-300">
          <p>
            {t('intro')}
          </p>

          <h2 className="text-lg font-semibold text-white">
            {t('controller')}
          </h2>

          <p>
            Philipp Dobrinski
            <br />
            Ultimate Hiking League
            <br />
            Ansbacher Straße 4a
            <br />
            91452 Wilhermsdorf
            <br />
            {t('country')}
          </p>

          <p>
            {t('email')}
          </p>

          <h2 className="text-lg font-semibold text-white">
            {t('access')}
          </h2>

          <p>
            {t('accessDetails')}
          </p>

          <h2 className="text-lg font-semibold text-white">
            {t('accounts')}
          </h2>

          <p>
            {t('accountsDetails')}
          </p>

          <p>
            {t('accountsPurpose')}
          </p>

          <h2 className="text-lg font-semibold text-white">
            {t('hikes')}
          </h2>

          <p>
            {t('hikeData')}
          </p>

          <p>
            {t('manualReview')}
          </p>

          <p>
            {t('publishedHikes')}
          </p>

          <p>
            {t('evidenceRetention')}
          </p>

          {process.env.NODE_ENV !== 'production' && (<>
          <h2 id="milestone-shop" className="scroll-mt-8 text-lg font-semibold text-white">
            {t('milestone')}
          </h2>
          <p>
            {t('milestoneData')}
          </p>
          <p>
            {t('merchantData')}
          </p>
          <p>
            {t('milestoneRetention')}
          </p>

                    </>)}
          <h2 id="garmin-connect" className="scroll-mt-8 text-lg font-semibold text-white">
            {t('garmin')}
          </h2>

          <p>
            {t('privateActivities')}
          </p>

          <p>
            {t('garminConsent')}
          </p>

          <p>
            {t('activitySource')}
          </p>

          <p>
            {t('garminProcessing')}
          </p>

          <p>
            {t('garminPublication')}
          </p>

          <p>
            {t('garminRetention')}
          </p>

          <h2 className="text-lg font-semibold text-white">
            {t('supabase')}
          </h2>

          <p>
            {t('supabaseDetails')}
          </p>

          <h2 className="text-lg font-semibold text-white">
            {t('cookies')}
          </h2>

          <p>
            {t('cookieConsent')}
          </p>

          <p>
            {t('changeConsentLead')}{" "}
            <Link
              href="/cookie-einstellungen"
              className="text-stone-200 underline underline-offset-4 hover:text-white"
            >
              {t('cookieSettings')}
            </Link>{" "}
            {t('changeConsentEnd')}
          </p>

          <h2 className="text-lg font-semibold text-white">
            {t('analytics')}
          </h2>

          <p>
            {t('analyticsDetails')}
          </p>

          <p>
            {t('analyticsActivation')}
          </p>

          <p>
            {t('analyticsData')}
          </p>

          <p>
            {t('provider')}
            <br />
            Google Ireland Limited
            <br />
            Gordon House, Barrow Street
            <br />
            Dublin 4
            <br />
            {t('ireland')}
          </p>

          <p>
            {t('googleNotice')}
          </p>

          <h2 className="text-lg font-semibold text-white">
            {t('legalBasis')}
          </h2>

          <p>
            {t('legalBasisDetails')}
          </p>

          <p>
            {t('analyticsBasis')}
          </p>

          <h2 className="text-lg font-semibold text-white">
            {t('retention')}
          </h2>

          <p>
            {t('retentionDetails')}
          </p>

          <h2 className="text-lg font-semibold text-white">
            {t('rights')}
          </h2>

          <p>
            {t('rightsDetails')} 
          </p>

          <p>
            {t('complaints')}
          </p>

          <h2 className="text-lg font-semibold text-white">{t('store')}</h2>
          <p>{t('storeOrders')}</p>
          <p>{t('storeProviders')}</p>
          <p>{t('storeWithdrawal')}</p>
          <p>{t('storeRetention')}</p>

          <h2 className="text-lg font-semibold text-white">
            {t('contact')}
          </h2>

          <p>
            {t('contactDetails')}
            <br />
            ultimatehikingleague@gmail.com
          </p>
        </div>
      </div>
    </main>
  )
}
