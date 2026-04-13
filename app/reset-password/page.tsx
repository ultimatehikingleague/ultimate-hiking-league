'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
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
          setMessage('Der Wiederherstellungslink ist ungültig oder abgelaufen.')
        } else {
          setReady(true)
        }
      } else {
        setMessage('Ungültiger oder unvollständiger Wiederherstellungslink.')
      }
    }

    void prepareRecoverySession()
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMessage('')

    if (password.length < 6) {
      setMessage('Das neue Passwort muss mindestens 6 Zeichen lang sein.')
      return
    }

    if (password !== confirmPassword) {
      setMessage('Die Passwörter stimmen nicht überein.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      setMessage(`Fehler: ${error.message}`)
    } else {
      setMessage('Dein Passwort wurde erfolgreich geändert. Du kannst dich jetzt neu einloggen.')
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
          ← Zurück zum Login
        </Link>

        <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-xl shadow-black/10 backdrop-blur-sm">
          <div className="mb-6 text-center">
            <img
              src="/ultimate-logo-transparent-weiss.png"
              alt="Ultimate Hiking League"
              className="mx-auto h-24 w-24 object-contain opacity-95"
            />
            <h1 className="mt-4 text-3xl font-bold text-white">
              Passwort zurücksetzen
            </h1>
            <p className="mt-2 text-sm text-stone-400">
              Vergib hier dein neues Passwort für deinen Zugang zur Liga.
            </p>
          </div>

          {ready ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-stone-300">
                  Neues Passwort
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
                  Passwort bestätigen
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
                {loading ? 'Speichert...' : 'Neues Passwort speichern'}
              </button>
            </form>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-stone-300">
              {message || 'Wiederherstellungslink wird geprüft...'}
            </div>
          )}

          {ready && message && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-stone-300">
              {message}
            </div>
          )}

          <div className="mt-6 text-center text-sm text-stone-400">
            <Link
              href="/login"
              className="text-white underline transition hover:text-stone-300"
            >
              Zurück zum Login
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}