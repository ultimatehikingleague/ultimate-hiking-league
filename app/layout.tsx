import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: 'Ultimate European Hiking League',
  description:
    'Europas Rangliste für Langstreckenwanderer. Sammle Kilometer, vergleiche dich und steig in Divisionen auf.',
  verification: {
    google: 'googleef14f047f6463c41',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
  <html lang="en">
    <body
      className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#141312] text-stone-100`}
    >
      <div className="flex min-h-screen flex-col">
        <main className="flex-1">
          {children}
        </main>

        <footer className="border-t border-white/10 px-6 py-6 text-sm text-stone-500">
          <div className="mx-auto flex max-w-6xl flex-wrap gap-6">
            <a href="/impressum" className="hover:text-white transition">
              Impressum
            </a>
            <a href="/datenschutz" className="hover:text-white transition">
              Datenschutz
            </a>
            <a href="/kontakt" className="hover:text-white transition">
              Kontakt
            </a>
          </div>
        </footer>
      </div>
    </body>
  </html>
);
}