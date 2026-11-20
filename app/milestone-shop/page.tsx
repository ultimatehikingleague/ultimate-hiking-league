'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import Link from '@/i18n/prototype/LocalizedLink'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import PartnerBenefits from './PartnerBenefits'

type ShopReward = {
  id: number
  title: string
  description: string | null
  partner_name: string | null
  reward_type: string
  points_cost: number
  image_url: string | null
  is_available: boolean
}

export default function MilestoneShopPage() {
  const t = useTranslations('milestones')
  const ui = useTranslations('ui')
  const locale = useLocale()
  const router = useRouter()
  const [rewards, setRewards] = useState<ShopReward[]>([])
  const [balance, setBalance] = useState<number | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [redeemingRewardId, setRedeemingRewardId] = useState<number | null>(null)
  const [redemptionError, setRedemptionError] = useState<string | null>(null)
  const [redeemedVoucherCode, setRedeemedVoucherCode] = useState<string | null>(null)

  useEffect(() => {
    async function loadShop() {
      setLoading(true)
      setError(null)

            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser()

            if (authError || !user) {
                router.replace('/login')
                return
            }

            const { data: catalog, error: catalogError } =
                await supabase.rpc('get_ordered_milestone_shop_catalog')

            if (catalogError) {
                console.error('Milestone catalog error:', catalogError)
                setError('catalogError')
           } else {
                setRewards(catalog ?? [])
                }

      

      setIsLoggedIn(!!user)

      if (user) {
        const { data: milestoneBalance, error: balanceError } =
          await supabase.rpc('get_my_milestone_balance')

        if (balanceError) {
          console.error('Milestone balance error:', balanceError)
        } else {
          setBalance(Number(milestoneBalance ?? 0))
        }
      }

      setLoading(false)
    }

    void loadShop()
    }, [router])

      async function handleRedeemReward(reward: ShopReward) {
        if (!isLoggedIn || redeemingRewardId !== null || !reward.is_available || reward.reward_type === 'product') return

        setRedeemingRewardId(reward.id)
        setRedemptionError(null)
        setRedeemedVoucherCode(null)

        try {
        const { data, error: redeemError } = await supabase.rpc(
            'redeem_reward',
            { p_reward_id: reward.id }
        )

        if (redeemError) {
            throw redeemError
        }

        const result = data?.[0]

        if (!result) {
            throw new Error('Keine Bestätigung der Einlösung erhalten.')
        }

        setRedeemedVoucherCode(result.voucher_code)
        setBalance(Number(result.remaining_points))

        } catch (err) {
        console.error('Milestone redemption error:', err)

        setRedemptionError(
            locale === 'de' && err && typeof err === 'object' && 'message' in err
            ? String(err.message)
            : t('redemptionError')
        )
        } finally {
        // Recheck availability after success and after stock-related failures.
        try {
          const { data: catalog, error: catalogError } = await supabase.rpc('get_ordered_milestone_shop_catalog')
          if (catalogError) throw catalogError
          setRewards(catalog ?? [])
          setError(null)
        } catch {
          setError('availabilityError')
        }
        setRedeemingRewardId(null)
        }
    }

      if (!isLoggedIn) {
        return (
        <main className="flex min-h-screen items-center justify-center bg-[#080d16]">
            <p className="text-sm text-slate-400">
            {t('checkingSignIn')}
            </p>
        </main>
        )
    }

  return (
    <main className="group/shop min-h-screen overflow-hidden bg-[#080d16] text-white">

      {/* Hintergrundakzente */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-64 top-24 h-[600px] w-[600px] rounded-full bg-cyan-500/[0.06] blur-[120px]" />
        <div className="absolute -right-64 top-[500px] h-[600px] w-[600px] rounded-full bg-teal-500/[0.05] blur-[120px]" />
      </div>

      <div className="relative z-10">

        {/* HEADER */}
        <header className="border-b border-white/10 bg-black/20">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-10">

            <Link href="/" className="flex items-center gap-4">
              <img
                src="/ultimate-logo-transparent-weiss.png"
                alt="ULTIMATE"
                className="h-14 w-14 object-contain md:h-16 md:w-16"
              />

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                  Ultimate Hiking League
                </p>

                <p className="text-lg font-bold tracking-wide">
                  MILESTONE SHOP
                </p>
              </div>
            </Link>

            <Link
              href="/"
              className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-slate-300 transition hover:border-cyan-400/40 hover:text-white"
            >
              {t('back')}
            </Link>
          </div>
        </header>

        {/* HERO */}
        <section className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 pb-20 pt-16 md:grid-cols-2 md:px-10 md:pb-28 md:pt-24">

          <div className="relative z-10">

            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />

              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                {t('rewarded')}
              </span>
            </div>

            <h1 className="max-w-2xl text-5xl font-black leading-[1.05] tracking-tight md:text-7xl">
              {t('every')}
              <br />
              {t('kilometre')}
              <br />
              <span
                style={{
                  background:
                    'linear-gradient(90deg, #67DCE8 0%, #21B8C9 55%, #49D5A5 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {t('counts')}
              </span>
            </h1>

            <p className="mt-8 max-w-xl text-lg leading-relaxed text-slate-400">
              {t('intro')}
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a
                href="#belohnungen"
                className="rounded-xl bg-[#67DCE8] px-7 py-3.5 text-sm font-bold text-[#07111a] transition hover:bg-[#8CEAF2]"
              >
                {t('discover')}
              </a>

              <a
                href="#partnervorteile"
                className="hidden rounded-xl border border-cyan-300/40 px-7 py-3.5 text-sm font-semibold text-cyan-200 hover:border-cyan-200 group-has-[#partnervorteile]/shop:inline-flex"
              >
                {t('benefits')}
              </a>

              <a
                href="#so-funktionierts"
                className="rounded-xl border border-white/15 px-7 py-3.5 text-sm font-semibold text-white transition hover:border-white/40"
              >
                {t('how')}
              </a>
            </div>
          </div>

          {/* HERO-KRISTALL */}
          <div className="relative flex min-h-[340px] items-center justify-center md:min-h-[520px]">

            <div className="absolute h-[300px] w-[300px] rounded-full bg-cyan-400/10 blur-[100px] md:h-[440px] md:w-[440px]" />

            <div className="absolute h-[260px] w-[260px] rounded-full border border-cyan-400/10 md:h-[420px] md:w-[420px]" />

            <div className="absolute h-[330px] w-[330px] rounded-full border border-white/[0.04] md:h-[520px] md:w-[520px]" />

            <img
              src="/images/milestone.png"
              alt={t('crystal')}
              className="relative z-10 h-[300px] w-[300px] object-contain drop-shadow-[0_0_55px_rgba(47,207,217,0.22)] md:h-[480px] md:w-[480px]"
            />

            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
                The Milestone
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {t('currency')}
              </p>
            </div>
          </div>
        </section>

        {/* GUTHABEN */}
        <section className="mx-auto max-w-7xl px-5 md:px-10">
          <div className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-r from-[#15232e] via-[#121d28] to-[#111820] p-7 md:p-10">

            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-400/[0.06] blur-[70px]" />

            <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">

              <div className="flex items-center gap-5">
                <img
                  src="/images/milestone.png"
                  alt=""
                  className="h-20 w-20 object-contain md:h-24 md:w-24"
                />

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                    {t('balance')}
                  </p>

                  <div className="mt-2 flex items-baseline gap-3">
                    <span
                      className="text-4xl font-black tracking-tight md:text-5xl"
                      style={{ color: '#67DCE8' }}
                    >
                      {loading
                        ? '...'
                        : balance === null
                          ? '–'
                          : balance.toLocaleString('de-DE')}
                    </span>

                    <span className="text-sm font-medium text-slate-300">
                      Milestones
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-slate-400">
                    {isLoggedIn
                      ? t('verification')
                      : t('signInBalance')}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {isLoggedIn ? (
                  <Link
                    href="/account"
                    className="rounded-xl border border-white/20 bg-white/[0.05] px-6 py-3 text-sm font-semibold transition hover:bg-white/10"
                  >
                    {t('hikerProfile')}
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    className="rounded-xl bg-[#67DCE8] px-6 py-3 text-sm font-bold text-[#07111a] transition hover:bg-[#8CEAF2]"
                  >
                    {t('signIn')}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        {isLoggedIn && <PartnerBenefits />}

        {/* BELOHNUNGEN */}
        <section
          id="belohnungen"
          className="mx-auto max-w-7xl px-5 pb-24 pt-12 md:px-10"
        >
          <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
                {ui('milestoneRewardsLabel')}
              </p>

              <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl">
                {t('yourRewards')}
              </h2>

              <p className="mt-4 max-w-xl text-slate-400">
                {t('rewardsIntro')}
              </p>
            </div>

            <div className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-xs font-medium text-slate-400">
              {t('exclusive')}
            </div>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-8 py-20 text-center text-slate-400">
              {t('loading')}
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-red-400/20 bg-red-400/5 px-8 py-12 text-center text-red-300">
              {error}
            </div>
          ) : rewards.length === 0 ? (

            /* LEERER KATALOG – NUR WÄHREND DER ENTWICKLUNG */
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#121a25] px-8 py-16 text-center">

            <img
                src="/images/milestone.png"
                alt=""
                className="mx-auto mb-6 h-20 w-20 object-contain"
            />

            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
                MILESTONE SHOP
            </p>

            <h3 className="text-2xl font-bold md:text-3xl">
                {ui('rewardsBanner')}
            </h3>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-400">
                {t('availableRewards')}
            </p>

            </div>

          ) : (

            /* PRODUKTKARTEN */
            <div className="grid gap-7 md:grid-cols-2 xl:grid-cols-3">

              {rewards.map((reward) => (
                <article
                  key={reward.id}
                  className="group overflow-hidden rounded-3xl border border-white/10 bg-[#141d28] transition duration-300 hover:-translate-y-1 hover:border-cyan-400/30 hover:shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
                >

                  {/* PRODUKTBILD */}
                  <div className="relative flex h-64 items-center justify-center overflow-hidden bg-[#1b2733]">

                    {reward.image_url ? (
                      <img
                        src={reward.image_url}
                        alt={reward.title}
                        className="h-full w-full object-contain p-12 transition duration-500 group-hover:scale-105"
                        />
                    ) : (
                      <img
                        src="/images/milestone.png"
                        alt=""
                        className="h-32 w-32 object-contain opacity-50"
                      />
                    )}

                    <div className="absolute left-5 top-5 rounded-full border border-white/10 bg-black/50 px-4 py-2 text-xs font-semibold backdrop-blur-md">
                      {reward.reward_type === 'product'
                        ? t('product')
                        : reward.reward_type === 'discount'
                          ? t('discount')
                          : t('voucher')}
                    </div>
                  </div>

                  {/* PRODUKTINFO */}
                  <div className="p-7">

                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                      {reward.partner_name || 'ULTIMATE PARTNER'}
                    </p>

                    <h3 className="mt-3 text-2xl font-bold">
                      {reward.title}
                    </h3>

                    <p className="mt-4 min-h-[72px] text-sm leading-relaxed text-slate-400">
                      {reward.description}
                    </p>

                    <div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-6">

                      <img
                        src="/images/milestone.png"
                        alt=""
                        className="h-10 w-10 object-contain"
                      />

                      <div>
                        <p
                          className="text-2xl font-extrabold"
                          style={{ color: '#67DCE8' }}
                        >
                          {reward.points_cost.toLocaleString('de-DE')}
                        </p>

                        <p className="text-xs text-slate-400">
                          Milestones
                        </p>
                      </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => void handleRedeemReward(reward)}
                        disabled={
                            !reward.is_available ||
                            reward.reward_type === 'product' ||
                            redeemingRewardId !== null ||
                            balance === null ||
                            balance < reward.points_cost
                        }
                        className={`mt-7 w-full rounded-xl px-6 py-4 text-sm font-bold transition ${
                            !reward.is_available ||
                            reward.reward_type === 'product' ||
                            redeemingRewardId !== null ||
                            balance === null ||
                            balance < reward.points_cost
                            ? 'cursor-not-allowed bg-slate-600 text-slate-300'
                            : 'bg-[#67DCE8] text-[#07111a] shadow-[0_0_25px_rgba(103,220,232,0.15)] hover:bg-[#8CEAF2]'
                        }`}
                        >
                        {redeemingRewardId === reward.id
                            ? t('redeeming')
                            : reward.reward_type === 'product'
                            ? t('unavailable')
                            : !reward.is_available
                            ? t('soldOut')
                            : balance === null
                            ? t('balanceUnavailable')
                            : balance < reward.points_cost
                                ? t('insufficient')
                                : t('claim')}
                        </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

                {/* EINLÖSEERGEBNIS */}
                {(redeemedVoucherCode || redemptionError) && (
                <section className="mx-auto max-w-7xl px-5 pb-16 md:px-10">
                    {redeemedVoucherCode && (
                    <div className="rounded-3xl border border-cyan-400/30 bg-[#122831] p-8 text-center">
                        <h3 className="text-2xl font-bold text-cyan-300">
                        {t('redeemed')}
                        </h3>

                        <p className="mt-4 text-sm text-slate-300">
                        {t('yourCode')}
                        </p>

                        <div className="mx-auto mt-5 max-w-md rounded-xl border border-cyan-400/30 bg-[#080d16] px-6 py-5">
                        <p className="break-all text-xl font-bold tracking-wider text-white">
                            {redeemedVoucherCode}
                        </p>
                        </div>

                        <p className="mt-4 text-sm text-slate-400">
                        {t('debited')}
                        </p>
                    </div>
                    )}

                    {redemptionError && (
                    <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-6 text-center">
                        <p className="font-semibold text-red-300">
                        {t('failed')}
                        </p>

                        <p className="mt-2 text-sm text-red-200">
                        {redemptionError}
                        </p>
                    </div>
                    )}
                </section>
                )}

        <div className="mx-auto max-w-7xl px-5 pb-12 md:px-10">
          <Link href="/milestone-shop/regeln" className="text-sm font-semibold text-cyan-300 underline underline-offset-4">{t('readRules')}</Link>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{t('partnerResponsibility')}</p>
        </div>

        {/* SO FUNKTIONIERT'S */}
        <section
          id="so-funktionierts"
          className="border-t border-white/10 bg-white/[0.02] py-24"
        >
          <div className="mx-auto max-w-7xl px-5 md:px-10">

            <div className="mb-14 text-center">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
                {t('system')}
              </p>

              <h2 className="text-3xl font-extrabold md:text-5xl">
                {t('hikingPays')}
              </h2>

              <p className="mx-auto mt-5 max-w-2xl text-slate-400">
                {t('threeSteps')}
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">

              {[
                {
                  number: '01',
                  title: t('hike'),
                  description:
                    t('hikeExplanation'),
                },
                {
                  number: '02',
                  title: t('earn'),
                  description:
                    t('earnExplanation'),
                },
                {
                  number: '03',
                  title: t('claim'),
                  description:
                    t('redeemExplanation'),
                },
              ].map((step) => (
                <div
                  key={step.number}
                  className="rounded-2xl border border-white/10 bg-[#141d28] p-8"
                >
                  <span
                    className="text-4xl font-black"
                    style={{ color: '#67DCE8' }}
                  >
                    {step.number}
                  </span>

                  <h3 className="mt-7 text-xl font-bold">
                    {step.title}
                  </h3>

                  <p className="mt-4 text-sm leading-relaxed text-slate-400">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>


      </div>
    </main>
  )
}