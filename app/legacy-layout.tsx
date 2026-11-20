import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages, getTranslations } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
import { isLocale, languageCookie, fallbackLocale, resolveLocale } from '../i18n/locales'
import { authLanguageCookie } from '../i18n/auth-language'
import { LanguagePreference } from './components/LanguageSwitcher'
import ContentLanguage from './components/ContentLanguage'
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
// @ts-ignore
import "./globals.css";
import CookieConsentBanner from "./components/CookieConsentBanner";
import GoogleAnalyticsLoader from "./components/GoogleAnalyticsLoader";
import SiteFooter from "./components/SiteFooter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const legacyMetadata: Metadata = {
  title: "Ultimate European Hiking League",
  description:
    "Europas Rangliste für Langstreckenwanderer. Sammle Kilometer, vergleiche dich und steig in Divisionen auf.",
  metadataBase: new URL("https://www.ultimatehikingleague.com"),

  verification: {
    google: "ZIK-G_8aqUkwIhHT1ar7Q2Zqapr47A0fJNb31OsMNPo",
  },

  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/apple-icon.png",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ui')
  return { ...legacyMetadata, description: t('titleDescription') }
}

export default async function RootLayout({
  children,
  admin = false,
}: Readonly<{
  children: React.ReactNode;
  admin?: boolean;
}>) {
  const [resolved, messages, cookieStore, requestHeaders] = await Promise.all([getLocale(), getMessages(), cookies(), headers()])
  const locale = isLocale(resolved) ? resolved : fallbackLocale
  const clientMessages = { ui: messages.ui }
  const manual = isLocale(cookieStore.get(languageCookie)?.value)
  const contextual = !manual && isLocale(cookieStore.get(authLanguageCookie)?.value)
  const browser = resolveLocale(null, requestHeaders.get('accept-language'))

  return (
    <html lang={locale}>
      <head>
        
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#141312] text-stone-100`}
      >
        <NextIntlClientProvider locale={locale} messages={clientMessages}>
          {admin ? (
            <div className="flex min-h-screen flex-col">
              <main className="flex-1">{children}</main>
              <CookieConsentBanner />
              <GoogleAnalyticsLoader />
              <SiteFooter />
            </div>
          ) : (
            <LanguagePreference manual={manual} contextual={contextual} browser={browser}>
              <div className="flex min-h-screen flex-col">
                <ContentLanguage>{children}</ContentLanguage>
                <CookieConsentBanner />
                <GoogleAnalyticsLoader />
                <SiteFooter />
              </div>
            </LanguagePreference>
          )}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
