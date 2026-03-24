'use client'

import Link from 'next/link'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (mode === 'register') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        setMessage(`Fehler: ${error.message}`)
      } else {
        setMessage('Registrierung erfolgreich. Du kannst dich jetzt einloggen.')
        setMode('login')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setMessage(`Fehler: ${error.message}`)
      } else {
        setMessage('Login erfolgreich ✅')
        window.location.href = '/'
      }
    }

    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
      <div className="mx-auto max-w-xl">
        <Link
          href="/"
          className="text-sm text-stone-400 transition hover:text-white"
        >
          ← Zurück zur Startseite
        </Link>

        <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-xl shadow-black/10 backdrop-blur-sm">
          <div className="mb-6 text-center">
            <img
              src="/ultimate-logo-transparent-weiss.png"
              alt="Ultimate Hiking League"
              className="mx-auto h-24 w-24 object-contain opacity-95"
            />
            <h1 className="mt-4 text-3xl font-bold text-white">
              {mode === 'login' ? 'Einloggen' : 'Registrieren'}
            </h1>
            <p className="mt-2 text-sm text-stone-400">
              {mode === 'login'
                ? 'Melde dich an, um später dein Profil zu übernehmen.'
                : 'Erstelle deinen Zugang zur Liga.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-stone-300">
                E-Mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-white/25"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-stone-300">
                Passwort
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-white/25"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-stone-100 px-5 py-3 text-sm font-medium text-stone-950 transition hover:bg-white disabled:opacity-60"
            >
              {loading
                ? 'Lädt...'
                : mode === 'login'
                ? 'Einloggen'
                : 'Registrieren'}
            </button>
          </form>

          {message && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-stone-300">
              {message}
            </div>
          )}

          <div className="mt-6 text-center text-sm text-stone-400">
            {mode === 'login' ? (
              <>
                Noch kein Konto?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register')
                    setMessage('')
                  }}
                  className="text-white underline transition hover:text-stone-300"
                >
                  Jetzt registrieren
                </button>
              </>
            ) : (
              <>
                Bereits registriert?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setMessage('')
                  }}
                  className="text-white underline transition hover:text-stone-300"
                >
                  Zum Login
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}