import Link from 'next/link'
import { checkoutEnabled } from '../../lib/shop/config'
export const dynamic = 'force-dynamic'
import Nav from '../../components/Nav'
import ProductGallery from '../components/ProductGallery'
import { calendarPreviewImages } from '../lib/products'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Compass,
  Mountain,
  ShieldCheck,
  Truck,
} from 'lucide-react'

export default function CalendarProductPage() {
  return (
    <main className="min-h-screen bg-[#141312] text-white">

      {/* HERO */}
      <section className="relative overflow-hidden">

        <div className="absolute inset-0">
          <img
            src="/mountain-hero.jpg"
            alt="Berglandschaft"
            className="h-full w-full object-cover object-[72%_18%]"
          />
        </div>

        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,10,14,0.26)_0%,rgba(10,12,16,0.42)_28%,rgba(12,12,12,0.70)_62%,#141312_100%)]" />

        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent to-[#141312]" />

        <div className="relative z-10 mx-auto max-w-7xl px-6 pb-16 pt-10 md:px-10 md:pb-20 md:pt-14">

          <header>

            <div className="flex justify-center">
              <img
                src="/ultimate-logo-transparent-weiss.png"
                alt="ULTIMATE"
                className="h-[230px] w-[230px] object-contain opacity-95"
              />
            </div>

            <div className="mx-auto max-w-5xl text-center">

              <div className="text-sm font-semibold uppercase tracking-[0.30em] text-stone-200 md:text-base">
                ULTIMATE OUTDOOR STORE
              </div>

              <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
                Made for your journey.
              </h1>

              <p className="mx-auto mt-5 text-lg text-stone-200">
                Für alle, die draußen zu Hause sind.
              </p>

            </div>

            <div className="mx-auto mt-8">
              <Nav />
            </div>

          </header>

        </div>
      </section>

      {/* PRODUKTDETAILS */}
      <div className="mx-auto max-w-7xl px-6 pb-24 md:px-10">

        {/* ZURÜCK */}
        <Link
          href="/shop"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-stone-300 transition hover:text-white"
        >
          <ArrowLeft size={17} />
          Zurück zum Shop
        </Link>

        <section className="overflow-hidden rounded-xl border border-[#D7D3C9] bg-[#F8F6F1] shadow-[0_25px_70px_rgba(0,0,0,0.30)]">

          <div className="grid lg:grid-cols-2">

            {/* PRODUKTGALERIE */}
            <div className="bg-[#E9E5DC] p-5 md:p-8">

              <ProductGallery images={calendarPreviewImages} />

            </div>

            {/* PRODUKTINFORMATIONEN */}
            <div className="flex flex-col bg-[#F8F6F1] p-7 text-[#20241F] md:p-10">

              <div className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#52724F]">
                <CalendarDays size={17} />
                ULTIMATE COLLECTION · 2027
              </div>

              <h2 className="text-3xl font-extrabold leading-tight tracking-tight md:text-[42px]">
                Schorschy&apos;s Wanderkalender 2027
              </h2>

              <p className="mt-5 text-lg font-semibold text-[#455044]">
                12 Monate. 12 Abenteuer.
              </p>

              <p className="mt-5 text-[15px] leading-7 text-[#626760]">
                Begleite unser Wandermurmeltier Schorschy durch ein
                ganzes Jahr voller Abenteuer, überraschender Begegnungen
                und unvergesslicher Momente.
              </p>

              <p className="mt-3 text-[15px] leading-7 text-[#626760]">
                Mit zwölf liebevoll gestalteten Monatsmotiven,
                ausgewählten Wanderveranstaltungen aus ganz Europa
                und den Feiertagen in Deutschland, Österreich
                und der Schweiz.
              </p>

              {/* PRODUKTMERKMALE */}
              <div className="mt-8 grid gap-4 border-y border-[#DDDCD5] py-6 sm:grid-cols-2">

                <div className="flex items-center gap-3 text-sm">
                  <CalendarDays size={19} className="shrink-0 text-[#52724F]" />
                  12 Monatsmotive
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <Mountain size={19} className="shrink-0 text-[#52724F]" />
                  Europäische Wanderevents
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <Compass size={19} className="shrink-0 text-[#52724F]" />
                  A3-Hochformat
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <Check size={19} className="shrink-0 text-[#52724F]" />
                  Feiertage in DE, AT & CH
                </div>

              </div>

              {/* KAUFBEREICH */}
              <div className="mt-8">

                <div className="text-[42px] font-extrabold tracking-tight">
                  29,90 €
                </div>

                <p className="mt-1 text-sm text-[#777B73]">
                  Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.
                </p>

                <p className="mt-2 text-sm text-[#777B73]">
                  Zuzüglich Versandkosten
                </p>

                {/* Platzhalter für spätere Produktvarianten */}
                {/* Hier werden bei anderen Produkten Größen- und Farbauswahl eingefügt. */}

                <div className="mt-8 rounded-lg border border-[#D7D3C9] bg-white p-5">

                  <div className="flex items-center gap-3 text-sm font-medium text-[#244B36]">
                    <ShieldCheck size={20} />
                    Hochwertiger Wandkalender
                  </div>

                  <div className="mt-3 flex items-center gap-3 text-sm text-[#626760]">
                    <Truck size={20} />
                    Versandkosten werden im Bestellprozess angezeigt.
                  </div>

                </div>

                {checkoutEnabled() ? (
                  <Link href="/shop/checkout" className="mt-6 flex min-h-[58px] w-full items-center justify-center rounded-lg bg-[#244B36] px-8 py-4 text-base font-bold text-white">Kalender bestellen</Link>
                ) : (
                  <button type="button" disabled className="mt-6 flex min-h-[58px] w-full cursor-not-allowed items-center justify-center rounded-lg bg-[#244B36] px-8 py-4 text-base font-bold text-white opacity-60">Bald erhältlich</button>
                )}

              </div>

            </div>

          </div>

        </section>

      </div>

    </main>
  )
}