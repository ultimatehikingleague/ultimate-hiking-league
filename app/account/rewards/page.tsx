'use client'

import { useLocale, useTranslations } from 'next-intl'
import Link from '@/i18n/prototype/LocalizedLink'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type RedeemedReward = {
  redemption_id: number
  reward_title: string
  partner_name: string | null
  reward_type: string
  reward_image_url: string | null
  points_spent: number
  voucher_code: string | null
  redemption_status: string
  redeemed_at: string
  redemption_url: string | null
  redemption_instructions: string | null
}

export default function MyRewardsPage() {
  const t = useTranslations('accountRewards')
  const locale = useLocale()

  const [loading, setLoading] = useState(true)
  const [rewards, setRewards] = useState<RedeemedReward[]>([])
  const [error, setError] = useState(false)

  useEffect(() => {
    async function loadRewards() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user) {
          window.location.replace('/login')
          return
        }

        const { data, error: rewardsError } = await supabase.rpc(
          'get_my_reward_redemptions'
        )

        if (rewardsError) {
          throw rewardsError
        }

        setRewards((data ?? []) as RedeemedReward[])
      } catch (err) {
        console.error('Reward history loading failed:', err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    void loadRewards()
  }, [])

  return (
    <main className="min-h-screen bg-[#080d16] px-5 py-12 text-white md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/account"
            className="text-sm text-slate-400 transition hover:text-white"
          >
            {t('backToYourHikerProfile')}
          </Link>

          <Link
            href="/milestone-shop"
            className="rounded-xl border border-[#67DCE8]/30 bg-[#67DCE8]/10 px-5 py-3 text-sm font-semibold text-[#67DCE8] transition hover:bg-[#67DCE8]/20"
          >
            {t('goToTheMilestoneShop')}
          </Link>
        </div>

        {/* HEADER */}
        <div className="relative mt-12 overflow-hidden rounded-3xl border border-[#67DCE8]/15 bg-gradient-to-br from-[#132633] via-[#0c1724] to-[#080d16] p-8 md:p-12">

          {/* Dezenter Lichtschein */}
          <div className="pointer-events-none absolute -right-20 -top-32 h-96 w-96 rounded-full bg-[#67DCE8]/10 blur-[100px]" />

          <div className="relative flex flex-col items-center gap-8 md:flex-row md:justify-between">

            <div className="text-center md:text-left">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#67DCE8]">
                ULTIMATE MILESTONE SHOP
              </p>

              <h1 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
                {t('myRewards')}
              </h1>

              <p className="mt-5 max-w-xl text-slate-400">
                {t('everyKilometreTakesYouFurtherHere')}
              </p>

              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#67DCE8]/20 bg-[#67DCE8]/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#67DCE8]">
                {t('yourPersonalRewards')}
              </div>
            </div>

            {/* Milestone-Edelstein */}
            <div className="relative flex shrink-0 items-center justify-center">

              <div className="absolute h-44 w-44 rounded-full bg-[#67DCE8]/15 blur-[55px]" />

              <img
                src="/images/milestone.png"
                alt="ULTIMATE Milestone"
                className="relative h-36 w-36 object-contain drop-shadow-[0_0_25px_rgba(103,220,232,0.25)] md:h-44 md:w-44"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="mt-12 text-slate-400">
            {t('loadingRewards')}
          </div>
        ) : error ? (
          <div className="mt-12 rounded-2xl border border-red-400/30 bg-red-400/10 p-6 text-red-200">
            {t('yourRewardsCouldNotBeLoaded')}
          </div>
        ) : rewards.length === 0 ? (
          <div className="mt-12 rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">
            <h2 className="text-xl font-bold">
              {t('noRewardsRedeemedYet')}
            </h2>

            <p className="mt-3 text-sm text-slate-400">
              {t('yourRedeemedRewardsWillAppearHere')}
            </p>

            <Link
              href="/milestone-shop"
              className="mt-7 inline-block rounded-xl bg-[#67DCE8] px-6 py-3 text-sm font-bold text-[#07111a] transition hover:bg-[#8CEAF2]"
            >
              {t('exploreTheMilestoneShop')}
            </Link>
          </div>
        ) : (
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {rewards.map((reward) => (
              <article
                key={reward.redemption_id}
                className="overflow-hidden rounded-3xl border border-white/10 bg-[#111c28]"
              >
                {reward.reward_image_url && (
                  <div className="flex h-48 items-center justify-center bg-[#0b1420] p-8">
                    <img
                      src={reward.reward_image_url}
                      alt={reward.reward_title}
                      className="h-full w-full object-contain"
                    />
                  </div>
                )}

                <div className="p-7">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#67DCE8]">
                    {reward.partner_name ?? 'ULTIMATE'}
                  </p>

                  <h2 className="mt-2 text-xl font-bold">
                    {reward.reward_title}
                  </h2>

                  <p className="mt-3 text-sm text-slate-400">
                    {t('redeemedOn')}{' '}
                    {new Date(reward.redeemed_at).toLocaleDateString(locale === 'de' ? 'de-DE' : locale === 'en' ? 'en-GB' : locale)}
                    {' · '}
                    {reward.points_spent.toLocaleString(locale === 'de' ? 'de-DE' : locale === 'en' ? 'en-GB' : locale)} Milestones
                  </p>

                  {reward.voucher_code && (
                    <div className="mt-6 rounded-xl border border-[#67DCE8]/30 bg-[#080d16] p-4">
                      <p className="text-xs uppercase tracking-widest text-slate-400">
                        {t('yourVoucherCode')}
                      </p>

                      <p className="mt-2 break-all text-lg font-bold tracking-wide text-[#67DCE8]">
                        {reward.voucher_code}
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          void navigator.clipboard.writeText(
                            reward.voucher_code!
                          )
                        }
                        className="mt-3 text-sm font-semibold text-white underline underline-offset-4 transition hover:text-[#67DCE8]"
                      >
                        {t('copyCode')}
                      </button>
                    </div>
                  )}

                {/* Einlösung beim Partner */}
                  {reward.redemption_url &&
                    (() => {
                      let safeUrl: string | null = null

                      try {
                        const parsedUrl = new URL(reward.redemption_url)

                        if (parsedUrl.protocol === 'https:') {
                          safeUrl = parsedUrl.href
                        }
                      } catch {
                        safeUrl = null
                      }

                      return safeUrl ? (
                        <div className="mt-5 space-y-4">
                          {reward.redemption_instructions && (
                            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                {t('redemptionInstructions')}
                              </p>

                              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-300">
                                {reward.redemption_instructions}
                              </p>
                            </div>
                          )}

                          <a
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex w-full items-center justify-center rounded-xl bg-[#67DCE8] px-5 py-3.5 text-center text-sm font-bold text-[#07111a] transition hover:bg-[#8CEAF2]"
                          >
                            {t('redeemAt', { partner: reward.partner_name ?? t('partner') })}
                          </a>

                          <p className="text-center text-xs text-slate-500">
                            {t('thePartnerWebsiteOpensInA')}
                          </p>
                        </div>
                      ) : null
                    })()}

                  <p className="mt-5 text-xs text-slate-500">
                    {t('status')}{' '}
                    <span className="font-semibold text-emerald-400">
                        {reward.redemption_status === 'completed'
                        ? t('complete')
                        : reward.redemption_status === 'pending'
                            ? t('inProgress')
                            : reward.redemption_status}
                    </span>
                    </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}