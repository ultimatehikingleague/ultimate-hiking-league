'use server'

import { cookies } from 'next/headers'
import { isLocale, languageCookie } from './locales'
import { authLanguageCookie } from './auth-language'

export async function setLanguage(choice: string) {
  if (choice !== 'auto' && !isLocale(choice)) return
  const cookieStore = await cookies()
  if (choice === 'auto') {
    cookieStore.delete(languageCookie)
    cookieStore.delete(authLanguageCookie)
    return
  }
  cookieStore.set(languageCookie, choice, {
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 365 * 24 * 60 * 60,
  })
}
