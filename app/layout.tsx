import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
// @ts-ignore
import "./globals.css";
import Script from "next/script";

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
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-M0ST1NQTGQ"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-M0ST1NQTGQ');
          `}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#141312] text-stone-100`}
      >
        <div className="flex min-h-screen flex-col">
          <main className="flex-1">{children}</main>

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
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}