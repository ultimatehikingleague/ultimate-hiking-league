import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import Link from '@/i18n/prototype/LocalizedLink'
import MilestoneCalculator from './MilestoneCalculator'
import '../offer-cards.css'
import styles from './rules.module.css'

export default function MilestoneRulesPage() {
  const t = useTranslations('milestoneRules')
  const locale = useLocale()
  const format = new Intl.NumberFormat(locale)
  const tiers = [
    { threshold: 'below30', factor: 1, example: 'example29' },
    { threshold: 'from30', factor: 1.5, example: 'example30' },
    { threshold: 'from100', factor: 2, example: 'example100' },
  ] as const
  const sections = [
    ['milestones', 'whatTitle'],
    ['sammeln', 'earningTitle'],
    ['multiplikator', 'multiplierTitle'],
    ['guthaben', 'balanceTitle'],
    ['einloesen', 'redeemingTitle'],
    ['partnervorteile', 'benefitsTitle'],
    ['haendler', 'contractsTitle'],
    ['verfuegbarkeit', 'availabilityTitle'],
    ['barauszahlung', 'cashTitle'],
    ['fairness', 'fairnessTitle'],
  ] as const

  return (
    <main className={styles.rules}>
      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroTop}>
            <Link href="/milestone-shop" aria-label="Ultimate Milestone Shop">
              <Image src="/ultimate-logo-transparent-weiss.png" alt="ULTIMATE" width={72} height={64} />
            </Link>
            <Link href="/milestone-shop" className="milestone-button">{t('back')}</Link>
          </div>
          <div className={styles.heroText}>
            <h1>{t('title')}</h1>
            <p className={styles.tagline}>{t('tagline')}</p>
            <p>{t('lead')}</p>
            <a href="#milestone-rechner" className="milestone-button">{t('calculator')}</a>
          </div>
          <Image src="/images/milestone.png" alt="" width={260} height={260} className={styles.crystal} />
        </div>
      </header>

      <div className={styles.content}>
        <nav aria-label={t('contents')} className={styles.contents}>
          <ol>
            {sections.map(([id, title]) => <li key={id}><a href={`#${id}`}>{t(title)}</a></li>)}
          </ol>
        </nav>
        <div className={styles.sections}>
          <section id="milestones" className={styles.card}>
            <h2>1. {t('whatTitle')}</h2>
            <p>{t('whatBody')}</p>
            <p>{t('noMoneyValue')}</p>
          </section>
          <section id="sammeln" className={styles.card}>
            <h2>2. {t('earningTitle')}</h2>
            <p>{t('earningBody')}</p>
            <p>{t('verificationBody')}</p>
            <p>{t('leagueLinkIntro')} <Link href="/rules">{t('leagueLink')}</Link>.</p>
          </section>
          <section id="multiplikator" className={`${styles.card} ${styles.wide}`}>
            <h2>3. {t('multiplierTitle')}</h2>
            <p>{t('multiplierBody')}</p>
            <div className={styles.calculationGrid}>
              <div>
                <p>{t('singleHike')}</p>
                <p>{t('tiers')}</p>
                <p>{t('rounding')}</p>
                <table className={styles.tiers}>
                  <caption>{t('caption')}</caption>
                  <thead><tr><th scope="col">{t('distance')}</th><th scope="col">{t('multiplier')}</th><th scope="col">{t('example')}</th></tr></thead>
                  <tbody>{tiers.map(({ threshold, factor, example }) => (
                    <tr key={threshold}><td>{t(threshold)}</td><td>× {format.format(factor)}</td><td>{t(example)}</td></tr>
                  ))}</tbody>
                </table>
                <p>{t('examples')}</p>
              </div>
              <MilestoneCalculator />
            </div>
          </section>
          <section id="guthaben" className={styles.card}>
            <h2>4. {t('balanceTitle')}</h2>
            <p>{t('balanceBody')}</p>
            <p>{t('balanceChange')}</p>
          </section>
          <section id="einloesen" className={styles.card}>
            <h2>5. {t('redeemingTitle')}</h2>
            <p>{t('redemptionBody')}</p>
            <p>{t('eligibility')}</p>
            <p>{t('historyBody')} <Link href="/account/rewards">„{t('myRewards')}“</Link>.</p>
            <p>{t('partnerRedemption')}</p>
          </section>
          <section id="partnervorteile" className={styles.card}>
            <h2>6. {t('benefitsTitle')}</h2>
            <p>{t('benefitsBody')}</p>
            <p>{t('benefitsCost')}</p>
            <p>{t('commission')}</p>
          </section>
          <section id="haendler" className={styles.card}>
            <h2>7. {t('contractsTitle')}</h2>
            <p>{t('platformBody')}</p>
            <p>{t('contractsBody')}</p>
            <p>{t('contractsService')}</p>
            <p>{t('storeSeller')}</p>
            <p>{t('partnerLiability')}</p>
          </section>
          <section id="verfuegbarkeit" className={styles.card}>
            <h2>8. {t('availabilityTitle')}</h2>
            <p>{t('availabilityBody')}</p>
            <p>{t('availabilityLimit')}</p>
            <p>{t('currentTerms')}</p>
            <p>{t('stock')}</p>
            <p>{t('acquiredRights')}</p>
          </section>
          <section id="barauszahlung" className={styles.card}>
            <h2>9. {t('cashTitle')}</h2>
            <p>{t('cashBody')}</p>
            <p>{t('cashClaim')}</p>
          </section>
          <section id="fairness" className={styles.card}>
            <h2>10. {t('fairnessTitle')}</h2>
            <p>{t('fairnessBody')}</p>
            <p>{t('abuseBody')}</p>
            <p>{t('legalRights')}</p>
          </section>
          <section className={styles.card}>
            <h2>{t('privacy')}</h2>
            <p>{t('privacyIntro')} <Link href="/datenschutz#milestone-shop">{t('privacyLink')}</Link>{t('merchantPrivacy')}</p>
            <p>{t('support')} <Link href="/kontakt">ULTIMATE</Link>{t('report')}</p>
          </section>
        </div>
      </div>
    </main>
  )
}
