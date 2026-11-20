import { useTranslations } from 'next-intl'
import Link from '@/i18n/prototype/LocalizedLink'

export default function MilestoneRulesPage() {
  const t = useTranslations('milestoneRules')
  return <main className="min-h-screen bg-[#080d16] px-6 py-12 text-slate-300 md:px-10">
    <div className="mx-auto max-w-4xl">
      <Link href="/milestone-shop" className="text-sm text-cyan-300 hover:text-white">{t('back')}</Link>
      <p className="mt-10 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">ULTIMATE MILESTONE SHOP</p>
      <h1 className="mt-4 text-3xl font-bold text-white md:text-5xl">{t('title')}</h1>
      <p className="mt-5 leading-7">{t('intro')}</p>

      <section id="sammeln" className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-7">
        <h2 className="text-2xl font-bold text-white">{t('earning')}</h2>
        <p className="mt-4 leading-7">{t('verified')}</p>
        <p className="mt-4 leading-7">{t('singleHike')}</p>
        <p className="mt-4 leading-7">{t('rounding')}</p>
        <p className="mt-4 leading-7">{t('tiers')}</p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="mb-3 text-left font-semibold text-white">{t('caption')}</caption>
            <thead className="border-b border-white/15 text-white"><tr><th scope="col" className="py-3 pr-4">{t('distance')}</th><th scope="col" className="py-3 pr-4">{t('multiplier')}</th><th scope="col" className="py-3">{t('example')}</th></tr></thead>
            <tbody className="divide-y divide-white/10">
              <tr><td className="py-3 pr-4">{t('below30')}</td><td className="py-3 pr-4">× 1</td><td className="py-3">{t('example29')}</td></tr>
              <tr><td className="py-3 pr-4">{t('from30')}</td><td className="py-3 pr-4">× 1,5</td><td className="py-3">{t('example30')}</td></tr>
              <tr><td className="py-3 pr-4">{t('from100')}</td><td className="py-3 pr-4">× 2</td><td className="py-3">{t('example100')}</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 leading-7">{t('examples')}</p>
        <p className="mt-4 leading-7">{t('leagueLinkIntro')} <Link href="/rules" className="text-cyan-300 underline underline-offset-4">{t('leagueLink')}</Link>.</p>
      </section>

      <section id="einloesen" className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-7">
        <h2 className="text-2xl font-bold text-white">{t('redeeming')}</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 leading-7">
          <li>{t('eligibility')}</li>
          <li>{t('chooseOffer')}</li>
          <li>{t('stored')} <Link href="/account/rewards" className="text-cyan-300 underline underline-offset-4">{t('myRewards')}</Link>{t('notYetUsed')}</li>
          <li>{t('merchantCode')}</li>
        </ol>
        <p className="mt-4 leading-7">{t('stock')}</p>
      </section>

      <section id="haendler" className="mt-6 rounded-3xl border border-cyan-400/20 bg-cyan-400/[0.04] p-7">
        <h2 className="text-2xl font-bold text-white">{t('responsibility')}</h2>
        <p className="mt-4 leading-7">{t('merchantResponsibilities')}</p>
        <p className="mt-4 leading-7">{t('uhlResponsibilities')}</p>
        <p className="mt-4 leading-7">{t('offerTerms')}</p>
        <p className="mt-4 leading-7">{t('support')} <Link href="/kontakt" className="text-cyan-300 underline underline-offset-4">ULTIMATE</Link>{t('report')}</p>
        <p className="mt-4 leading-7">{t('liability')}</p>
      </section>

      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-7">
        <h2 className="text-2xl font-bold text-white">{t('privacy')}</h2>
        <p className="mt-4 leading-7">{t('privacyIntro')} <Link href="/datenschutz#milestone-shop" className="text-cyan-300 underline underline-offset-4">{t('privacyLink')}</Link>{t('merchantPrivacy')}</p>
      </section>
    </div>
  </main>
}
