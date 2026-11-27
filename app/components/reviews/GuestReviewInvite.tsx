'use client'

import { useEffect, useState } from 'react'
import Link from '@/i18n/prototype/LocalizedLink'
import { supabase } from '@/app/lib/supabase'

const invitations: Record<string, [string, string]> = {
  de: ['Schon mitgewandert? Nach der Registrierung kannst du verifizierte Teilnahmen bewerten.', 'Registrieren'],
  en: ['Taken part? Register to review your verified event participations.', 'Register'],
  fr: ['Vous avez participé ? Inscrivez-vous pour évaluer vos participations vérifiées.', 'S’inscrire'],
  nl: ['Meegedaan? Registreer je om je geverifieerde deelnames te beoordelen.', 'Registreren'],
  it: ['Hai partecipato? Registrati per recensire le tue partecipazioni verificate.', 'Registrati'],
  es: ['¿Has participado? Regístrate para valorar tus participaciones verificadas.', 'Registrarse'],
  pl: ['Masz za sobą udział? Zarejestruj się, aby ocenić swoje zweryfikowane uczestnictwo.', 'Zarejestruj się'],
  cs: ['Zúčastnili jste se? Zaregistrujte se a ohodnoťte své ověřené účasti.', 'Zaregistrovat se'],
}

export default function GuestReviewInvite({ locale }: { locale: string }) {
  const [guest, setGuest] = useState(false)
  const [message, action] = invitations[locale] ?? invitations.en

  useEffect(() => {
    // INITIAL_SESSION covers the first read; later events cover login and logout.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setGuest(!session))
    return () => subscription.unsubscribe()
  }, [])

  if (!guest) return null
  return <p className="text-sm text-stone-400">
    {message}{' '}<Link href="/login?mode=register" className="text-stone-200 underline underline-offset-4 hover:text-white">{action}</Link>
  </p>
}
