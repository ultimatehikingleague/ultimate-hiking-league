import { useTranslations } from 'next-intl'
import Link from '@/i18n/prototype/LocalizedLink'
import BrandHeader from '../components/BrandHeader'

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/10 backdrop-blur-sm md:p-8">
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-7 text-stone-300">
        {children}
      </div>
    </section>
  )
}

function RuleList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          <span className="mt-1 text-stone-500">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export default function RulesPage() {
  const t = useTranslations('leagueRules')
  const ui = useTranslations('ui')
  return (
    <main className="min-h-screen bg-[#141312] text-stone-100">
      <section
        className="relative overflow-hidden border-b border-white/10"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgba(20,19,18,0.30), rgba(20,19,18,0.85)), url('/leaderboard-hero.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="mx-auto max-w-6xl px-6 py-12 md:px-10 md:py-16">
          <BrandHeader />

          <Link
            href="/"
            className="inline-block text-sm text-stone-300 transition hover:text-white"
          >
            {t('back')}
          </Link>

          <div className="mt-6 max-w-3xl rounded-[2rem] border border-white/10 bg-black/25 p-6 shadow-2xl shadow-black/20 backdrop-blur-sm md:p-8">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-stone-300">
              {t('league')}
            </div>

            <h1 className="mt-2 text-4xl font-bold tracking-tight text-white md:text-5xl">
              {t('title')}
            </h1>

            <p className="mt-3 text-sm leading-6 text-stone-300 md:text-base">
              {t('intro')}
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 py-10 md:px-10 md:py-12">
        <div className="mx-auto max-w-5xl space-y-6">
          <Section title={t('principle')}>
            <p>
              {t('permanentRanking')}
            </p>
            <p>
              {t('placementDistanceOnly')}
            </p>
            <p>
              {t('divisionsDescribeProfile')}
            </p>
          </Section>

          <Section title={t('seasonModel')}>
            <RuleList
              items={[
                <>{t('calendarYear')}</>,
                <>{t('seasonStart')}</>,
                <>{t('seasonEnd')}</>,
                <>{t('seasonReset')}</>,
                <>{t('seasonArchives')}</>,
              ]}
            />
          </Section>

          <Section title={t('validRecord')}>
            <p>{t('recordDefinition')}</p>

            <p className="font-semibold text-white">{t('requiredFields')}</p>
            <RuleList
              items={[
                <>{t('hikerName')}</>,
                <>{t('hikeDate')}</>,
                <>{t('kilometres')}</>,
              ]}
            />

            <p className="font-semibold text-white">{t('extraFields')}</p>
            <RuleList
              items={[
                <>{t('elapsedTime')}</>,
                <>{t('elevation')}</>,
                <>{t('country')}</>,
                <>{t('eventName')}</>,
                <>{t('source')}</>,
              ]}
            />

            <p className="font-semibold text-white">{t('minimum')}</p>
            <RuleList
              items={[
                <>{t('minimumDistance')}</>,
                <>
                  {t('minimumElevation')}
                </>,
              ]}
            />
          </Section>

          <Section title={t('privateHikes')}>
            <p>
              {t('privateHikesAllowed')}
            </p>

            <p className="font-semibold text-white">{t('requirements')}</p>
            <RuleList
              items={[
                <>{t('privateGpsEvidence')}</>,
                <>{t('privateData')}</>,
              ]}
            />

            <p className="font-semibold text-white">{t('important')}</p>
            <RuleList
              items={[
                <>{t('privateOverall')}</>,
                <>{t('privateClassification')}</>,
                <>{t('privatePromotion')}</>,
              ]}
            />
          </Section>

          <Section title={t('officialEvents')}>
            <p>
              {t('officialEventsAssessPerformance')}
            </p>

            <p className="font-semibold text-white">{ui('rulesHighlight')}</p>
            <RuleList
              items={[
                <>{t('onlyEventResults')}</>,
                <>{t('privateNoImpact')}</>,
                <>
                  {t('officialTrackThreshold')}
                </>,
              ]}
            />
          </Section>

          <Section title={t('timeScoring')}>
            <p>
              {t('elapsedTimeOnly')}
            </p>

            <RuleList
              items={[
                <>{t('movingTime')}</>,
                <>{t('walkingTime')}</>,
                <>{t('adjustedTime')}</>,
                <>
                  {t('confirmedEventTimes')}
                </>,
              ]}
            />
          </Section>

          <Section title={t('divisionThresholds')}>
            <p>
              {t('confirmedAverage')}
            </p>

            <RuleList
              items={[
                <>
                  <strong>Silver</strong> {t('silverRange')}
                </>,
                <>
                  <strong>Gold</strong> {t('goldRange')}
                </>,
                <>
                  <strong>Platinum</strong> {t('platinumRange')}
                </>,
              ]}
            />

            <p>{t('speedFormula')}</p>
            <p>{t('eventTierAndProfile')}</p>
            <p>{t('defaultSilver')}</p>
          </Section>

          <Section title={t('rollingCalculation')}>
            <p>{t('dynamicDivision')}</p>
            <p className="font-semibold text-white">{t('basicRule')}</p>
            <RuleList
              items={[
                t('rollingConfirmedTime'),
                t('rollingPrivateExcluded'),
                t('rollingEventTier'),
                t('rollingThreeEvents'),
                t('rollingFiveEvents'),
                t('rollingOrder'),
              ]}
            />
            <p className="font-semibold text-white">{t('rollingFormula')}</p>
          </Section>

          <Section title={t('divisionMovement')}>
            <h3 className="font-semibold text-white">{t('promotion')}</h3>
            <p>{t('promotionThreeResults')}</p>
            <RuleList items={[t('silverToGold'), t('goldToPlatinum')]} />
            <p>{t('promotionExample')}</p>

            <h3 className="font-semibold text-white">{t('relegation')}</h3>
            <p>{t('relegationFiveResults')}</p>
            <RuleList items={[t('platinumToGold'), t('goldToSilver')]} />
            <p>{t('relegationInterrupted')}</p>

            <h3 className="font-semibold text-white">{t('movementGeneral')}</h3>
            <p>{t('movementStep')}</p>
          </Section>

          <Section title={t('rankings')}>
            <p>
              {t('rankDistanceOnly')}
            </p>

            <RuleList
              items={[
                <>{t('speedAndRank')}</>,
                <>{t('speedAndDivision')}</>,
                <>{t('silverBeforePlatinum')}</>,
              ]}
            />
          </Section>

          <Section title={t('eventStructure')}>
            <RuleList
              items={[
                <>{t('eventDefinition')}</>,
                <>{t('eventVariants')}</>,
              ]}
            />
          </Section>

          <Section title={t('skyscraper')}>
            <p>
              {t('skyscraperSeparate')}
            </p>

            <RuleList
              items={[
                <>{t('elevationSum')}</>,
                <>{t('elevationVisibility')}</>,
                <>{t('elevationOnly')}</>,
                <>{t('distanceSpeedExcluded')}</>,
                <>{t('skyscraperParallel')}</>,
              ]}
            />
          </Section>

          <Section title={t('claims')}>
            <p>
              {t('linkProfile')}
            </p>

            <RuleList
              items={[
                <>{t('claimDetails')}</>,
                <>{t('claimEvidence')}</>,
                <>{t('afterClaim')}</>,
              ]}
            />
          </Section>

          <Section title={t('fairness')}>
            <RuleList
              items={[
                <>{t('correctData')}</>,
                <>{t('rejectManipulation')}</>,
                <>{t('manualReview')}</>,
                <>{t('submissionMethods')}</>,
                <>{t('evidenceReview')}</>,
                <>{t('manualApproval')}</>,
                <>{t('garminPrivateVerification')}</>,
                <>{t('garminEventApproval')}</>,
                <>{t('garminConnection')}</>,
                <>{t('oneSubmission')}</>,
                <>{t('fairnessGoal')}</>,
              ]}
            />
          </Section>
        </div>
      </section>
    </main>
  )
}