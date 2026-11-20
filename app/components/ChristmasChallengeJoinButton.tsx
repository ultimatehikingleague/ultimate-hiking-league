'use client'

import { useTranslations } from 'next-intl'
import Link from '@/i18n/prototype/LocalizedLink'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Props = {
  challengeId: number
  challengeStatus: string
}

export default function ChristmasChallengeJoinButton({
  challengeId,
  challengeStatus,
}: Props) {
  const t = useTranslations('ui')
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [hikerId, setHikerId] = useState<number | null>(null)
  const [hasJoined, setHasJoined] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function loadStatus() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        setLoading(false)
        return
      }

      setIsLoggedIn(true)

      const { data: hiker } = await supabase
        .from('hikers')
        .select('id')
        .eq('claimed_by_user_id', session.user.id)
        .maybeSingle()

      if (!hiker) {
        setLoading(false)
        return
      }

      setHikerId(hiker.id)

      const { data: participation } = await supabase
        .from('challenge_participants')
        .select('id')
        .eq('challenge_id', challengeId)
        .eq('hiker_id', hiker.id)
        .maybeSingle()

      setHasJoined(Boolean(participation))
      setLoading(false)
    }

    loadStatus()
  }, [challengeId])

  async function joinChallenge() {
    if (!hikerId || joining || hasJoined) return

    setJoining(true)
    setMessage('')

    const { error } = await supabase
      .from('challenge_participants')
      .insert({
        challenge_id: challengeId,
        hiker_id: hikerId,
      })

    if (error) {
      setMessage(
        t('joinError')
      )
      setJoining(false)
      return
    }

    setHasJoined(true)
    setJoining(false)
  }

  if (loading) {
    return (
      <div className="mt-6 text-sm text-stone-400">
        {t('checkingRegistration')}
      </div>
    )
  }

  if (hasJoined) {
    return (
      <div className="inline-flex min-h-[50px] items-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-6 py-3 font-semibold text-emerald-200">
        {t('registered')}
      </div>
    )
  }

  if (!isLoggedIn) {
  return (
    <div>
      <Link
        href="/login"
        className="inline-flex min-h-[50px] items-center justify-center rounded-2xl bg-red-600 px-7 py-3 font-semibold text-white transition hover:bg-red-500"
      >
        {t('signInJoin')}
      </Link>
    </div>
  )
}

  if (!hikerId) {
    return (
      <div className="mt-6">
        <p className="text-sm text-amber-200">
          {t('profileFirst')}
        </p>

        <Link
          href="/account"
          className="mt-3 inline-flex min-h-[50px] items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
        >
          {t('createProfile')}
        </Link>
      </div>
    )
  }

  if (challengeStatus === 'draft') {
    return (
      <div className="mt-6 text-sm text-stone-400">
        {t('registrationNotOpen')}
      </div>
    )
  }

  if (challengeStatus === 'active' || challengeStatus === 'finished') {
    return (
      <div className="mt-6 text-sm text-stone-400">
        {t('registrationClosed')}
      </div>
    )
  }

  if (challengeStatus !== 'registration') {
    return null
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={joinChallenge}
        disabled={joining}
        className="inline-flex min-h-[50px] items-center justify-center rounded-2xl bg-red-600 px-7 py-3 font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {joining
          ? t('joining')
          : t('registerChallenge')}
      </button>

      {message ? (
        <div className="mt-3 text-sm text-red-300">
          {message}
        </div>
      ) : null}
    </div>
  )
}