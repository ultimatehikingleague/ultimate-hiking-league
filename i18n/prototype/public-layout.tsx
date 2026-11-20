import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import type { ReactNode } from 'react'
import { Geist, Geist_Mono } from 'next/font/google'
import '../../app/globals.css'
import CookieConsentBanner from '../../app/components/CookieConsentBanner'
import GoogleAnalyticsLoader from '../../app/components/GoogleAnalyticsLoader'
import SiteFooter from '../../app/components/SiteFooter'
import ContentLanguage from '../../app/components/ContentLanguage'
import type { Locale } from '../locales'

const geist = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const mono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
export async function PrototypeLayout({ children, locale }: { children: ReactNode; locale: Locale }) {
  setRequestLocale(locale)
  const messages = await getMessages()
  return (
    <html lang={locale}>
      <body className={`${geist.variable} ${mono.variable} antialiased bg-[#141312] text-stone-100`}>
        <NextIntlClientProvider locale={locale} messages={{ ui: messages.ui }}>
          <div className="flex min-h-screen flex-col">
            <ContentLanguage>{children}</ContentLanguage>
            <CookieConsentBanner />
            <GoogleAnalyticsLoader />
            <SiteFooter />
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
