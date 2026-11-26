'use client'

import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import Link from '@/i18n/prototype/LocalizedLink'
import { supabase } from '../lib/supabase'
import { startVisiblePolling } from '../lib/visiblePolling'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { usePartnerBenefits } from './PartnerBenefits'
import PartnerBenefitCards from './PartnerBenefitCards'
import OfferArtwork, { offerLandscapes } from './OfferArtwork'
import OfferText, { externalOfferUrl } from './OfferText'
import styles from './shop.module.css'

type OfferTerms = {
  redemption_url: string | null
  redemption_instructions: string | null
}

export type ShopReward = Partial<OfferTerms> & {
  id: number
  title: string
  description: string | null
  partner_name: string | null
  reward_type: string
  points_cost: number
  image_url: string | null
  is_available: boolean
  is_active?: boolean
}

const filters = ['allOffers', 'freeTickets', 'discounts', 'freeBenefits'] as const
type Filter = typeof filters[number]
const offersPerPage = 6

export default function MilestoneShop({ previewRewards, userId }: { previewRewards?: ShopReward[]; userId?: string }) {
  const preview = previewRewards !== undefined
  const t = useTranslations('milestones')
  const partner = useTranslations('partnerBenefits')
  const locale = useLocale()
  const [rewards, setRewards] = useState<ShopReward[]>(previewRewards ?? [])
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(!preview)
  const [error, setError] = useState<string | null>(null)
  const [redeemingRewardId, setRedeemingRewardId] = useState<number | null>(null)
  const [redemptionError, setRedemptionError] = useState<string | null>(null)
  const [redeemedVoucherCode, setRedeemedVoucherCode] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('allOffers')
  const [offerPage, setOfferPage] = useState(0)
  const [selected, setSelected] = useState<ShopReward | null>(null)
  const [terms, setTerms] = useState<OfferTerms | 'error' | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const { benefits, status: benefitStatus } = usePartnerBenefits(true, preview)

  const active = useRef(false)
  const balanceVersion = useRef(0)
  const redemptionPending = useRef(false)
  const redemptionRequests = useRef(new Map<number, string>())

  useEffect(() => {
    active.current = true
    let cancelled = false

    async function loadCatalogue() {
      const version = balanceVersion.current
      const { data, error } = await supabase.rpc('get_ordered_milestone_shop_catalog')
      if (cancelled || version !== balanceVersion.current) return
      if (error) {
        console.error('Milestone catalog error:', error)
        setError('catalogError')
      } else {
        setRewards(data ?? [])
        setError(null)
      }
      setLoading(false)
    }

    async function refreshBalance() {
      if (redemptionPending.current) return
      const version = ++balanceVersion.current
      const { data, error } = await supabase.rpc('get_my_milestone_balance')
      if (cancelled || version !== balanceVersion.current) return
      if (error) console.error('Milestone balance error:', error)
      setBalance(error ? null : Number(data ?? 0))
    }

    const stopPolling = startVisiblePolling(async () => {
      if (redemptionPending.current) return
      await Promise.all([refreshBalance(), preview ? undefined : loadCatalogue()])
    })
    return () => {
      cancelled = true
      active.current = false
      stopPolling()
    }
  }, [preview])

  function requestStorageKey(rewardId: number) {
    return 'uhl:milestone-redemption:' + userId + ':' + rewardId
  }

  function rememberRequest(rewardId: number, requestId: string | null) {
    if (requestId) redemptionRequests.current.set(rewardId, requestId)
    else redemptionRequests.current.delete(rewardId)
    if (!userId) return
    try {
      if (requestId) sessionStorage.setItem(requestStorageKey(rewardId), requestId)
      else sessionStorage.removeItem(requestStorageKey(rewardId))
    } catch { /* In-memory retries still work if storage is unavailable. */ }
  }

  async function handleRedeemReward(reward: ShopReward) {
    const previousRequest = redemptionRequests.current.get(reward.id)
    if (preview || redemptionPending.current || (!previousRequest && !canRedeem(reward))) return

    const requestId = previousRequest ?? crypto.randomUUID()
    rememberRequest(reward.id, requestId)

    redemptionPending.current = true
    balanceVersion.current++
    setRedeemingRewardId(reward.id)
    setRedemptionError(null)
    setRedeemedVoucherCode(null)

    try {
      const { data, error } = await supabase.rpc('redeem_reward', { p_reward_id: reward.id, p_request_id: requestId })
      if (!active.current) return
      if (error) throw error
      const result = data?.[0]
      if (!result) throw new Error('Missing redemption confirmation')

      rememberRequest(reward.id, null)
      setRedeemedVoucherCode(result.voucher_code)
      if (!previousRequest) setBalance(Number(result.remaining_points))
    } catch (err) {
      if (!active.current) return
      console.error('Milestone redemption error:', err)
      setRedemptionError(t('redemptionError'))
    } finally {
      if (active.current) {
        // Recheck availability after success and after stock-related failures.
        try {
          const [{ data, error }, currentBalance] = await Promise.all([
            supabase.rpc('get_ordered_milestone_shop_catalog'),
            supabase.rpc('get_my_milestone_balance'),
          ])
          if (active.current && !currentBalance.error) setBalance(Number(currentBalance.data ?? 0))
          if (error) throw error
          if (active.current) {
            setRewards(data ?? [])
            setError(null)
          }
        } catch {
          if (active.current) setError('availabilityError')
        }
        redemptionPending.current = false
        if (active.current) setRedeemingRewardId(null)
      }
    }
  }

  useEffect(() => {
    if (!selected) return
    if (!dialog.current?.open) dialog.current?.showModal()
    let cancelled = false

    async function loadTerms(reward: ShopReward) {
      if (reward.redemption_instructions !== undefined && reward.redemption_url !== undefined) {
        setTerms({
          redemption_instructions: reward.redemption_instructions,
          redemption_url: reward.redemption_url,
        })
        return
      }
      const { data, error } = await supabase.from('reward_catalog')
        .select('redemption_instructions,redemption_url')
        .eq('id', reward.id)
        .eq('is_active', true)
        .single()
      if (!cancelled) setTerms(error || !data ? 'error' : data)
    }

    void loadTerms(selected)
    return () => { cancelled = true }
  }, [selected])

  function openOffer(reward: ShopReward) {
    if (userId && !redemptionRequests.current.has(reward.id)) {
      try {
        const id = sessionStorage.getItem(requestStorageKey(reward.id))
        if (id) redemptionRequests.current.set(reward.id, id)
      } catch { /* Storage is optional. */ }
    }
    setTerms(null)
    setRedemptionError(redemptionRequests.current.has(reward.id) ? t('redemptionError') : null)
    setRedeemedVoucherCode(null)
    setSelected(reward)
  }

  function actionLabel(reward: ShopReward) {
    if (redeemingRewardId === reward.id) return t('redeeming')
    if (reward.reward_type === 'product') return t('unavailable')
    if (!reward.is_available) return t('soldOut')
    if (balance === null) return t('balanceUnavailable')
    if (balance < reward.points_cost) return t('insufficient')
    return t('claim')
  }

  function canRedeem(reward: ShopReward) {
    return !preview && reward.reward_type !== 'product' && reward.is_available && balance !== null && balance >= reward.points_cost
  }

  const tickets = rewards.filter(reward => reward.reward_type === 'voucher')
  const discounts = rewards.filter(reward => reward.reward_type === 'discount')
  const visibleRewards = filter === 'freeTickets' ? tickets : filter === 'discounts' ? discounts : rewards
  const landscapes = offerLandscapes(rewards)
  const pageCount = Math.ceil(visibleRewards.length / offersPerPage)
  const currentPage = Math.min(offerPage, Math.max(0, pageCount - 1))
  const pageRewards = visibleRewards.slice(currentPage * offersPerPage, (currentPage + 1) * offersPerPage)
  const counts = { allOffers: rewards.length, freeTickets: tickets.length, discounts: discounts.length, freeBenefits: benefits.length }
  const selectedReward = rewards.find(reward => reward.id === selected?.id) ?? selected
  const retrying = selectedReward !== null && !!redemptionError && redemptionRequests.current.has(selectedReward.id)
  const termsUrl = terms && terms !== 'error' ? externalOfferUrl(terms.redemption_url) : null
  const number = new Intl.NumberFormat(locale)

  return (
    <main className={styles.shop}>
      {preview && (
        <aside className={styles.previewNote}>
          <Link href="/admin/milestone-shop">← {t('manageRewards')}</Link>
          <span>{t('previewNotice')}</span>
        </aside>
      )}
      <div className={styles.languageBar}>
        <LanguageSwitcher compact />
      </div>
      <header className={styles.hero}>
        <div className={styles.heroArt} aria-hidden="true">
          <picture>
            <source media="(max-width: 680px)" srcSet="/images/milestone-shop/schorschy-small.webp" />
            <Image src="/images/milestone-shop/schorschy.webp" fill sizes="100vw" alt="" unoptimized loading="eager" fetchPriority="high" />
          </picture>
          <Image src="/ultimate-logo-transparent-weiss.png" width={800} height={705} alt="" unoptimized className={styles.capLogo} />
        </div>
        <div className={styles.heroContent}>
          <Image className={styles.brand} src="/ultimate-logo-transparent-weiss.png" alt="ULTIMATE" width={800} height={705} unoptimized />
          <Link href="/" className={`${styles.back} milestone-button`}><span aria-hidden="true">←</span> {t('backHome')}</Link>
          <div className={styles.heading}>
            <div className={styles.headingTitle}>
              <Image src="/images/milestone.png" width={86} height={86} alt="" className={styles.crystal} />
              <h1>{t.rich('shopName', { accent: chunks => <em>{chunks}</em> })}</h1>
            </div>
            <p>{t('shopIntro')}</p>
          </div>
          <div className={styles.balance}>
            <p>{t('balance')}</p>
            <div className="flex items-center gap-2">
              <Image src="/images/milestone.png" width={64} height={64} alt="" className={styles.crystal} />
              <p><strong>{balance === null ? '–' : number.format(balance)}</strong><span>{t('pointsUnit')}</span></p>
            </div>
          </div>
        </div>
      </header>

      <div className={styles.content}>
        <nav className={styles.filters} aria-label={t('allOffers')}>
          {filters.map(option => (
            <button key={option} type="button" aria-pressed={filter === option} onClick={() => {
              setFilter(option)
              setOfferPage(0)
            }}>
              {t(option)} {' '}
              {(option === 'freeBenefits' ? benefitStatus === 'ready' : !loading && !error) && <span>({number.format(counts[option])})</span>}
            </button>
          ))}
        </nav>

        {filter !== 'freeBenefits' && (
          <section aria-label={t(filter)} className={styles.regular}>
            {loading && <p role="status" className={styles.message}>{t('loading')}</p>}
            {error && <p role="alert" className={styles.message}>{t(error === 'availabilityError' ? 'availabilityError' : 'catalogError')}</p>}
            {!loading && !error && (visibleRewards.length === 0 ? <p className={styles.message}>{t('noOffers')}</p> : (
              <>
                <div className="milestone-grid">
                  {pageRewards.map(reward => {
                    const variant = reward.reward_type === 'voucher' ? 'ticket' : reward.reward_type === 'discount' ? 'discount' : 'product'
                    return (
                      <article key={reward.id} className="milestone-card">
                        <OfferArtwork landscape={landscapes.get(reward.id)!} image={reward.image_url} cover={/\bwanderkalender\b/i.test(reward.title)} variant={variant} label={t(variant)} />
                        <div className="milestone-card-body">
                          {reward.partner_name && <p className="milestone-partner">{reward.partner_name}</p>}
                          <h2>{reward.title}</h2>
                          {reward.description && <p className="milestone-summary"><OfferText text={reward.description} linkify={false} /></p>}
                          {preview
                            ? <p className="milestone-card-note">{reward.is_active ? partner('active') : partner('draft')}</p>
                            : !canRedeem(reward) && <p className="milestone-card-note">{actionLabel(reward)}</p>}
                          <div className="milestone-card-footer">
                            <p className="milestone-price">
                              <Image src="/images/milestone.png" width={34} height={34} alt="" className={styles.crystal} />
                              <strong>{number.format(reward.points_cost)}</strong> {t('pointsUnit')}
                            </p>
                            <button type="button" className="milestone-button w-full" onClick={() => openOffer(reward)} aria-haspopup="dialog" aria-label={`${canRedeem(reward) ? t('claim') : t('offerDetails')} · ${reward.title}`}>
                              {canRedeem(reward) ? <>{t('claim')} <span aria-hidden="true">→</span></> : t('offerDetails')}
                            </button>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
                {pageCount > 1 && (
                  <div className={styles.pagination}>
                    <button type="button" className="milestone-button" aria-label={t('previousOffers')} disabled={currentPage === 0} onClick={() => setOfferPage(currentPage - 1)}>‹</button>
                    <p role="status" className="px-2 text-sm">{t('offerPage', { page: currentPage + 1, total: pageCount })}</p>
                    <button type="button" className="milestone-button" aria-label={t('nextOffers')} disabled={currentPage + 1 >= pageCount} onClick={() => setOfferPage(currentPage + 1)}>›</button>
                  </div>
                )}
              </>
            ))}
          </section>
        )}

        {(filter === 'allOffers' || filter === 'freeBenefits') && (
          <>
            {benefitStatus === 'error' && <p role="alert" className={styles.message}>{partner('loadError')}</p>}
            {filter === 'freeBenefits' && benefitStatus === 'loading' && <p role="status" className={styles.message}>{t('loading')}</p>}
            {filter === 'freeBenefits' && benefitStatus === 'ready' && !benefits.length && <p className={styles.message}>{t('noOffers')}</p>}
            {benefits.length > 0 && <PartnerBenefitCards benefits={benefits} preview={preview} />}
          </>
        )}

        <footer className="mt-8 pb-10 text-sm text-slate-300">
          <Link href={preview ? '/milestone-shop/regeln?from=preview' : '/milestone-shop/regeln'} className="font-semibold text-cyan-200 underline underline-offset-4">{t('readRules')}</Link>
          <p className="mt-2 max-w-3xl">{t('partnerResponsibility')}</p>
        </footer>
      </div>

      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby="milestone-offer-title"
        onCancel={event => { if (redeemingRewardId !== null) event.preventDefault() }}
        onClose={() => setSelected(null)}
      >
        {selectedReward && (
          <>
            <h2 id="milestone-offer-title" className="text-2xl font-bold">{selectedReward.title}</h2>
            {selectedReward.description && <p className="mt-4 whitespace-pre-line"><OfferText text={selectedReward.description} /></p>}
            <h3 className="mt-5 font-bold text-cyan-100">{t('offerDetails')}</h3>
            {terms === null && <p role="status">{t('loadingDetails')}</p>}
            {terms === 'error' && <p role="alert">{t('detailsError')}</p>}
            {terms && terms !== 'error' && (
              <>
                {terms.redemption_instructions && <p className="mt-2 whitespace-pre-line"><OfferText text={terms.redemption_instructions} /></p>}
                {termsUrl && <a className="mt-2 inline-block text-cyan-200 underline" href={termsUrl} target="_blank" rel="noopener noreferrer">{partner('view')}</a>}
                {!terms.redemption_instructions && !termsUrl && <p>{t('noDetails')}</p>}
              </>
            )}
            {redeemedVoucherCode && (
              <div role="status" className="mt-5 rounded-xl border border-cyan-300/40 bg-cyan-950 p-4">
                <h3 className="font-bold text-cyan-200">{t('redeemed')}</h3>
                <p>{t('yourCode')}</p>
                <p className="my-2 break-all font-mono text-lg font-bold">{redeemedVoucherCode}</p>
                <p>{t('debited')}</p>
              </div>
            )}
            {redemptionError && <p role="alert" className="mt-4 text-red-200">{redemptionError}</p>}
            {!redeemedVoucherCode && (
              <>
                <p className="mt-5 font-semibold text-cyan-100">{number.format(selectedReward.points_cost)} {t('pointsUnit')}</p>
                <button type="button" className="milestone-button mt-3 w-full" disabled={redeemingRewardId !== null || (!retrying && (!canRedeem(selectedReward) || terms === null || terms === 'error'))} onClick={() => void handleRedeemReward(selectedReward)}>
                  {retrying ? t('retryRedemption') : preview || (canRedeem(selectedReward) && redeemingRewardId === null) ? t('confirmClaim') : actionLabel(selectedReward)}
                </button>
              </>
            )}
            <form method="dialog" className="mt-3">
              <button className="milestone-button w-full" type="submit" disabled={redeemingRewardId !== null}>{t('closeDetails')}</button>
            </form>
          </>
        )}
      </dialog>
    </main>
  )
}
