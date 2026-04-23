import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
// @ts-ignore
import "./globals.css";
import CookieConsentBanner from "./components/CookieConsentBanner";
import GoogleAnalyticsLoader from "./components/GoogleAnalyticsLoader";
import PartnershipFooter from "./components/PartnershipFooter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <head>
        
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#141312] text-stone-100`}
      >
        <div className="flex min-h-screen flex-col">
          <main className="flex-1">{children}</main>
          <CookieConsentBanner />
          <GoogleAnalyticsLoader />
          <PartnershipFooter />

         <footer className="border-t border-white/10 px-6 py-6 text-sm text-stone-500">
            <div className="mx-auto max-w-6xl">
              <div className="flex flex-wrap items-center gap-6">
                <a href="/impressum" className="hover:text-white transition">
                  Impressum
                </a>
                <a href="/datenschutz" className="hover:text-white transition">
                  Datenschutz
                </a>
                <a href="/kontakt" className="hover:text-white transition">
                  Kontakt
                </a>
                <a href="/disclaimer" className="hover:text-white transition">
                  Disclaimer
                </a>
                <a href="/cookie-einstellungen" className="hover:text-white transition">
                  Cookie-Einstellungen
                </a>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}