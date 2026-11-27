'use client'

import { useLocale, useTranslations } from 'next-intl'
import { isWave1Locale } from '@/i18n/wave1'
import Link from '@/i18n/prototype/LocalizedLink'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const milestoneShopPath = '/milestone-shop'
const authCallback = 'https://www.ultimatehikingleague.com/login'

function milestoneReturnPath() {
  const destinations = new URLSearchParams(window.location.search).getAll('next')
  return destinations.length === 1 && destinations[0] === milestoneShopPath ? milestoneShopPath : null
}

function milestoneAuthCallback() {
  // Supabase accepts callbacks on its configured Site URL origin.
  return 'https://ultimatehikingleague.com/login?' + new URLSearchParams({ next: milestoneShopPath })
}

async function postLoginDestination() {
  const destination = milestoneReturnPath()
  if (!destination) return '/'
  try {
    const { data, error } = await supabase.rpc('milestone_shop_is_live')
      .abortSignal(AbortSignal.timeout(5000))
    if (!error && data === true) return destination
  } catch {
    // Return to the homepage when the shop's global status cannot be confirmed.
  }
  return '/'
}

type Mode = 'login' | 'register' | 'forgot_password'

export default function LoginPage() {
  const t = useTranslations('login')
  const ui = useTranslations('ui')
  const locale = useLocale()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<'' | 'blockedLogin' | 'blockedRegistration' | 'loginUnavailable' | 'registered' | 'registrationUnavailable' | 'resetRequested' | 'signedIn' | { providerError: string; code?: string }>('')
  function displayMessage() {
    if (typeof message !== 'object') return message ? t(message) : ''
    if (!isWave1Locale(locale)) return t('providerError', { message: message.providerError })
    return ui(message.code === 'invalid_credentials' ? 'authInvalidCredentials' : 'authProviderIssue')
  }

  const messageText = displayMessage()

  useEffect(() => {
    async function checkOAuthBan() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) return

      try {
        const response = await fetch('/api/enforce-user-ban', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        if (!response.ok) {
          console.error('OAuth ban enforcement failed')
          return
        }

        const result = await response.json()

        if (result.banned) {
          await supabase.auth.signOut()

          setMessage('blockedLogin')
          return
        }

        if (milestoneReturnPath()) window.location.replace(await postLoginDestination())
      } catch (error) {
        console.error('OAuth ban enforcement failed:', error)
      }
    }

    checkOAuthBan()
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (mode === 'register') {
      const banResponse = await fetch('/api/check-user-ban', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      if (!banResponse.ok) {
        setMessage('registrationUnavailable')
        setLoading(false)
        return
      }

      const banResult = await banResponse.json()

      if (banResult.banned) {
        setMessage('blockedRegistration')
        setLoading(false)
        return
      }

      const destination = milestoneReturnPath()
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        ...(destination && { options: { emailRedirectTo: milestoneAuthCallback() } }),
      })

      if (error) {
        setMessage({ providerError: error.message, code: error.code })
      } else {
        await fetch('/api/send-submission-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            type: 'welcome',
          }),
        })

        if (destination && data.session) {
          window.location.assign(await postLoginDestination())
          return
        }

        setMessage('registered')
        setMode('login')
        setPassword('')
      }
    } else if (mode === 'forgot_password') {
      const redirectTo = 'https://www.ultimatehikingleague.com/reset-password'

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      })

      if (error) {
        setMessage({ providerError: error.message, code: error.code })
      } else {
        setMessage('resetRequested')
      }
    } else {
      const banResponse = await fetch('/api/check-user-ban', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      if (!banResponse.ok) {
        setMessage('loginUnavailable')
        setLoading(false)
        return
      }

      const banResult = await banResponse.json()

      if (banResult.banned) {
        await supabase.auth.signOut()

        setMessage('blockedLogin')
        setLoading(false)
        return
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setMessage({ providerError: error.message, code: error.code })
      } else {
        setMessage('signedIn')
        window.location.assign(await postLoginDestination())
      }
    }

    setLoading(false)
  }

  async function handleGoogleLogin() {
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: milestoneReturnPath() ? milestoneAuthCallback() : authCallback,
      },
    })

    if (error) {
      setMessage({ providerError: error.message, code: error.code })
      setLoading(false)
    }
  }

  const title =
    mode === 'login'
      ? t('signIn')
      : mode === 'register'
      ? t('register')
      : t('forgot')

  const subtitle =
    mode === 'login'
      ? t('signInDescription')
      : mode === 'register'
      ? t('registerDescription')
      : t('resetDescription')

  return (
    <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
      <div className="mx-auto max-w-xl">
        <Link
          href="/"
          className="text-sm text-stone-400 transition hover:text-white"
        >
          {t('backHome')}
        </Link>

        <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-xl shadow-black/10 backdrop-blur-sm">
          <div className="mb-6 text-center">
            <img
              src="/ultimate-logo-transparent-weiss.png"
              alt="Ultimate Hiking League"
              className="mx-auto h-24 w-24 object-contain opacity-95"
            />
            <h1 className="mt-4 text-3xl font-bold text-white">{title}</h1>
            <p className="mt-2 text-sm text-stone-400">{subtitle}</p>
          </div>

                      {mode !== 'forgot_password' && (
                        <>
                          <button
                            type="button"
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="mb-4 flex h-14 w-full items-center justify-center rounded-2xl border border-white/10 bg-white px-5 transition hover:bg-stone-100 disabled:opacity-60"
                          >
                            <div className="flex items-center gap-3">
                              <img
                                src="/google-g-logo.png"
                                alt="Google"
                                className="h-6 w-6 shrink-0"
                              />
                              <span className="text-sm font-semibold text-black">
                                {mode === 'login'
                                  ? t('googleSignIn')
                                  : t('googleRegister')}
                              </span>
                            </div>
                          </button>

                          <div className="mb-4 flex items-center gap-3">
                            <div className="h-px flex-1 bg-white/10" />
                            <span className="text-xs uppercase tracking-[0.18em] text-stone-500">
                              {t('or')}
                            </span>
                            <div className="h-px flex-1 bg-white/10" />
                          </div>
                        </>
                      )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-stone-300">
                {t('email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-white/25"
              />
            </div>

            {mode !== 'forgot_password' && (
              <div>
                <label className="mb-2 block text-sm font-medium text-stone-300">
                  {t('password')}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-white/25"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-stone-100 px-5 py-3 text-sm font-medium text-stone-950 transition hover:bg-white disabled:opacity-60"
            >
              {loading
                ? t('loading')
                : mode === 'login'
                ? t('signIn')
                : mode === 'register'
                ? t('register')
                : t('sendResetLink')}
            </button>
          </form>

          {mode === 'login' && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode('forgot_password')
                  setPassword('')
                  setMessage('')
                }}
                className="text-sm text-stone-300 underline transition hover:text-white"
              >
                {t('forgotLink')}
              </button>
            </div>
          )}

          {message && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-stone-300">
              {messageText}
            </div>
          )}

          <div className="mt-6 text-center text-sm text-stone-400">
            {mode === 'login' ? (
              <>
                {t('noAccount')}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register')
                    setMessage('')
                  }}
                  className="text-white underline transition hover:text-stone-300"
                >
                  {t('registerNow')}
                </button>
              </>
            ) : mode === 'register' ? (
              <>
                {t('alreadyRegistered')}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setMessage('')
                  }}
                  className="text-white underline transition hover:text-stone-300"
                >
                  {t('signInLink')}
                </button>
              </>
            ) : (
              <>
                {t('backTo')}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setMessage('')
                  }}
                  className="text-white underline transition hover:text-stone-300"
                >
                  {t('loginLink')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}