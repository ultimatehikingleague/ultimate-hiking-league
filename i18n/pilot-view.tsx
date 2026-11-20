import type { ReactNode } from 'react'
import { cache } from 'react'
import { createTranslator } from 'next-intl'
import { Geist } from 'next/font/google'
import PilotLanguageMenu from './PilotLanguageMenu'
import { catalogs, pilotCatalogs } from './catalogs'
import { requirePreview, type PreviewLocale } from './phase3'
import '../app/globals.css'

const font = Geist({ subsets: ['latin', 'cyrillic'], display: 'swap' })

const navKeys = ['home', 'rankings', 'divisions', 'leagueRules', 'calendar', 'questions'] as const
const accountKeys = ['couldNotSave', 'uploadFailed', 'yourProfileDetailsWereSaved', 'unknownError', 'emailChangeFailed', 'yourSessionHasExpiredPleaseSign', 'loadingLeagueProfile', 'pleaseWaitAMoment', 'myLeagueProfile', 'noProfileYet', 'createProfile', 'signOut', 'signedInAs', 'editProfile', 'nationality', 'gender', 'emailAddress', 'newEmailAddress', 'cancel', 'save', 'season', 'currentDivision', 'overallRank', 'totalKm', 'myRecords', 'noRecordsYet', 'privateRecord', 'inReview'] as const
const ruleSections = [
  ['principle', ['permanentRanking', 'placementDistanceOnly', 'divisionsDescribeProfile']],
  ['validRecord', ['minimumDistance', 'minimumElevation']],
  ['fairness', ['correctData', 'rejectManipulation', 'manualReview', 'submissionMethods', 'evidenceReview', 'manualApproval', 'garminPrivateVerification', 'garminEventApproval', 'garminConnection', 'oneSubmission', 'fairnessGoal']],
] as const
const reference = {
  en: { title: 'Language preview', description: 'Rule excerpts and sample navigation and account messages. No personal data.', navigation: 'Navigation', account: 'Account messages', records: '{count, plural, one {# saved hike} other {# saved hikes}}' },
  de: { title: 'Sprachvorschau', description: 'Regelauszüge und Beispiele für Navigation und Kontomeldungen. Ohne personenbezogene Daten.', navigation: 'Navigation', account: 'Kontomeldungen', records: '{count, plural, one {# gespeicherte Wanderung} other {# gespeicherte Wanderungen}}' },
}
const load = cache(async (locale: PreviewLocale) => {
  requirePreview()
  if (locale === 'de' || locale === 'en') return { ...await catalogs[locale](), pilot: reference[locale] }
  return pilotCatalogs[locale]()
})

export async function PilotLayout({ children, preference }: {
  children: ReactNode
  preference: { locale: PreviewLocale; manual: boolean; browser?: PreviewLocale; explicit?: boolean }
}) {
  const { ui } = await load(preference.locale)
  const { language, browserLanguage, languageError } = ui
  return (
    <html lang={preference.locale}>
      <body className={`${font.className} bg-[#141312] text-stone-100`}>
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8">
          <header className="relative flex justify-end">
            <PilotLanguageMenu preference={preference} ui={{ language, browserLanguage, languageError }} />
          </header>
          {children}
        </div>
      </body>
    </html>
  )
}

export async function PilotPage({ locale }: { locale: PreviewLocale }) {
  const messages = await load(locale)
  const translate = createTranslator({ locale, messages })
  return (
    <main className="space-y-8 [overflow-wrap:anywhere]">
      <header>
        <h1 className="text-3xl font-bold">{messages.pilot.title}</h1>
        <p className="mt-2 text-stone-300">{messages.pilot.description}</p>
      </header>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">{messages.pilot.navigation}</h2>
        <ul className="flex flex-wrap gap-2">
          {navKeys.map(key => <li key={key} className="rounded border border-white/20 px-3 py-2">{messages.ui[key]}</li>)}
        </ul>
      </section>
      <section id="account" className="space-y-3">
        <h2 className="text-xl font-semibold">{messages.pilot.account}</h2>
        <ul className="list-disc space-y-1 pl-5">
          {accountKeys.map(key => <li key={key}>{messages.account[key]}</li>)}
          <li>{translate('account.seasonKm', { year: '2026' })}</li>
          <li>{translate('account.reviewedOn', { date: new Intl.DateTimeFormat(locale, { timeZone: 'UTC' }).format(new Date('2026-11-16')) })}</li>
          {[1, 2, 5, 21, 22, 1.5].map(count => <li key={count}>{translate('pilot.records', { count })}</li>)}
        </ul>
      </section>
      <section id="login" className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 rounded border border-white/20 p-4">
          <h2 className="text-xl font-semibold">{messages.login.signIn}</h2>
          <p>{messages.login.signInDescription}</p>
          <p>{messages.login.googleSignIn}</p>
          <h3 className="font-semibold">{messages.login.register}</h3>
          <p>{messages.login.registerDescription}</p>
          <p>{messages.login.resetRequested}</p>
        </div>
        <div className="space-y-2 rounded border border-white/20 p-4">
          <h2 className="text-xl font-semibold">{messages.resetPassword.title}</h2>
          <p>{messages.resetPassword.intro}</p>
          <p>{messages.resetPassword.expired}</p>
          <p>{messages.resetPassword.minLength}</p>
          <p>{messages.logout.title}</p>
        </div>
      </section>
      <article className="space-y-5">
        <h2 className="text-2xl font-bold">{messages.leagueRules.title}</h2>
        {ruleSections.map(([heading, paragraphs]) => (
          <section key={heading} className="space-y-2">
            <h3 className="text-lg font-semibold">{messages.leagueRules[heading]}</h3>
            {paragraphs.map(key => <p key={key}>{messages.leagueRules[key]}</p>)}
          </section>
        ))}
      </article>
    </main>
  )
}
