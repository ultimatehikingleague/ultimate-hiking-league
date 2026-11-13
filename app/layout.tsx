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
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}