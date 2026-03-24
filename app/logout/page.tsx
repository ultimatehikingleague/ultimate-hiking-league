'use client'

import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function LogoutPage() {
  useEffect(() => {
    async function doLogout() {
      await supabase.auth.signOut()
      window.location.href = '/'
    }

    void doLogout()
  }, [])

  return (
    <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
      <div className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center shadow-xl shadow-black/10 backdrop-blur-sm">
        <h1 className="text-2xl font-bold text-white">Du wirst abgemeldet…</h1>
        <p className="mt-3 text-stone-400">Einen Moment bitte.</p>
      </div>
    </main>
  )
}