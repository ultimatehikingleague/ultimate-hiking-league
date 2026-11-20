'use client'

import { useLocale, useTranslations } from 'next-intl'
import { isWave1Locale } from '@/i18n/wave1'
import Link from '@/i18n/prototype/LocalizedLink'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ResetPasswordPage() {
  const t = useTranslations('resetPassword')
  const ui = useTranslations('ui')
  const locale = useLocale()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<'' | 'expired' | 'invalid' | 'minLength' | 'mismatch' | 'updated' | { providerError: string }>('')
  function displayMessage() {
    if (typeof message !== 'object') return message ? t(message) : ''
    if (!isWave1Locale(locale)) return t('providerError', { message: message.providerError })
    return ui('authSavePasswordFailed')
  }

  const messageText = displayMessage()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function prepareRecoverySession() {
      const hash = window.location.hash
      const params = new URLSearchParams(hash.replace(/^#/, ''))

      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      const type = params.get('type')

      if (type === 'recovery' && accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (error) {
          setMessage('expired')
        } else {
          setReady(true)
        }
      } else {
        setMessage('invalid')
      }
    }

    void prepareRecoverySession()
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMessage('')

    if (password.length < 6) {
      setMessage('minLength')
      return
    }

    if (password !== confirmPassword) {
      setMessage('mismatch')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      setMessage({ providerError: error.message })
    } else {
      setMessage('updated')
      setPassword('')
      setConfirmPassword('')
    }

    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
      <div className="mx-auto max-w-xl">
        <Link
          href="/login"
          className="text-sm text-stone-400 transition hover:text-white"
        >
          {t('backArrow')}
        </Link>

        <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-xl shadow-black/10 backdrop-blur-sm">
          <div className="mb-6 text-center">
            <img
              src="/ultimate-logo-transparent-weiss.png"
              alt="Ultimate Hiking League"
              className="mx-auto h-24 w-24 object-contain opacity-95"
            />
            <h1 className="mt-4 text-3xl font-bold text-white">
              {t('title')}
            </h1>
            <p className="mt-2 text-sm text-stone-400">
              {t('intro')}
            </p>
          </div>

          {ready ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-stone-300">
                  {t('newPassword')}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-white/25"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-stone-300">
                  {t('confirmPassword')}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-white/25"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-stone-100 px-5 py-3 text-sm font-medium text-stone-950 transition hover:bg-white disabled:opacity-60"
              >
                {loading ? t('saving') : t('save')}
              </button>
            </form>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-stone-300">
              {messageText || t('checking')}
            </div>
          )}

          {ready && message && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-stone-300">
              {messageText}
            </div>
          )}

          <div className="mt-6 text-center text-sm text-stone-400">
            <Link
              href="/login"
              className="text-white underline transition hover:text-stone-300"
            >
              {t('back')}
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}