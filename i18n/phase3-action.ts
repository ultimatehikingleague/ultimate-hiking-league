'use server'

import { cookies } from 'next/headers'
import { isPreviewLocale, previewCookie, requirePreview } from './phase3'

export async function setPreviewLanguage(choice: string) {
  requirePreview()
  if (choice !== 'auto' && !isPreviewLocale(choice)) return
  const jar = await cookies()
  if (choice === 'auto') {
    jar.delete(previewCookie)
    return
  }
  jar.set(previewCookie, choice, { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 31536000 })
}
