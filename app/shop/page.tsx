import { useLocale, useTranslations } from 'next-intl'
import { storeTagline } from '@/i18n/polish-store'
import Link from '@/i18n/prototype/LocalizedLink'
import Nav from '../components/Nav'
import {
  ArrowRight,
  CalendarDays,
  Check,
  Compass,
  Mountain,
  ShieldCheck,
  Truck,
} from 'lucide-react'

export default function ShopPage() {
  const locale = useLocale()
  const t = useTranslations('outdoorStore')
  const ui = useTranslations('ui')
  return (
    <main className="min-h-screen bg-[#141312] text-white">

      {/* =====================================================
          HERO – ULTIMATE OUTDOOR STORE
      ===================================================== */}

      <section className="relative overflow-hidden">

        {/* Original-Hintergrund */}
        <div className="absolute inset-0">
          <img
            src="/mountain-hero.jpg"
            alt={t('hero')}
            className="h-full w-full object-cover object-[72%_18%] md:object-[72%_16%] xl:object-[72%_14%]"
          />
        </div>

        {/* Original-Farbverläufe */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,10,14,0.26)_0%,rgba(10,12,16,0.42)_28%,rgba(12,12,12,0.70)_62%,#141312_100%)]" />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_30%)]" />

        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent to-[#141312]" />

        <div className="relative z-10 mx-auto max-w-7xl px-6 pb-16 pt-10 md:px-10 md:pb-20 md:pt-14">

          <header>

            {/* Original-ULTIMATE-Logo */}
            <div className="mb-0 flex justify-center">
              <img
                src="/ultimate-logo-transparent-weiss.png"
                alt="ULTIMATE"
                className="h-[230px] w-[230px] object-contain opacity-95 drop-shadow-[0_0_24px_rgba(255,255,255,0.08)]"
              />
            </div>

            {/* Markenpositionierung */}
            <div className="mx-auto max-w-5xl text-center">

              <div className="mb-0 text-sm font-semibold uppercase tracking-[0.30em] text-stone-200 md:text-base">
                ULTIMATE OUTDOOR STORE
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-white md:text-5xl">
                {storeTagline(locale)}
              </h1>

              <p className="mx-auto mt-5 max-w-3xl text-lg font-medium text-stone-200">
                {t('tagline')}
              </p>

            </div>

            {/* Bestehende Navigation */}
            <div className="mx-auto mt-8 max-w-7xl">
              <Nav />
            </div>

          </header>

        </div>
      </section>


      {/* =====================================================
          SHOP-INHALT
      ===================================================== */}

      <div className="mx-auto max-w-7xl px-6 pb-24 md:px-10">

        {/* Einleitung */}
        <section className="mb-10">

          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-[#A9C68B]">
            <Compass size={16} />
            {ui('discoverStore')}
          </div>

          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
            {t('products')}
          </h2>

          <p className="mt-3 max-w-2xl text-base leading-7 text-stone-400">
            {t('productsIntro')}
          </p>

        </section>


        {/* =====================================================
            FEATURED PRODUCT
        ===================================================== */}

        <section className="mb-10 overflow-hidden rounded-xl border border-[#D7D3C9] bg-[#F3F0E9] shadow-[0_25px_70px_rgba(0,0,0,0.30)]">

          <div className="grid lg:grid-cols-[1fr_1fr]">

            {/* PRODUKTBILD */}
            <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden bg-[#E9E5DC] p-7 md:p-12">

              {/* Dezenter Hintergrundakzent */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.85),transparent_75%)]" />

              {/* Produktkennzeichnung */}
              <div className="absolute left-5 top-5 z-20 rounded-md bg-[#244B36] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white">
                {t('new2027')}
              </div>

              {/* Original-Kalendercover */}
                <img
                src="/shop/wanderkalender-2027/cover-final.webp"
                alt="Schorschy's Wanderkalender 2027"
                className="relative z-10 object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.22)]"
                style={{ width: '410px', maxWidth: '100%', height: 'auto' }}
                />
              

            </div>


            {/* PRODUKTINFORMATIONEN */}
            <div className="flex flex-col justify-center bg-[#F8F6F1] p-8 text-[#20241F] md:p-12">

              {/* Kategorie */}
              <div className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#52724F]">
                <CalendarDays size={17} />
                ULTIMATE COLLECTION · 2027
              </div>

              {/* Produktname */}
              <h3 className="text-3xl font-extrabold leading-[1.12] tracking-tight text-[#20241F] md:text-[42px]">
                Schorschy&apos;s
                <br />
                Wanderkalender 2027
              </h3>

              {/* Kurzbeschreibung */}
              <p className="mt-5 text-lg font-semibold text-[#455044]">
                {t('twelveAdventures')}
              </p>

              <p className="mt-5 text-[15px] leading-7 text-[#626760]">
                {t('marmot')}
              </p>

              <p className="mt-3 text-[15px] leading-7 text-[#626760]">
                {t('productDetails')}
                </p>


              {/* PRODUKTMERKMALE */}
              <div className="mt-7 grid gap-x-5 gap-y-4 border-y border-[#DDDCD5] py-6 sm:grid-cols-2">

                <div className="flex items-center gap-3 text-sm font-medium text-[#404840]">
                  <CalendarDays
                    size={19}
                    className="shrink-0 text-[#52724F]"
                  />
                  {t('monthlyArt')}
                </div>

                <div className="flex items-center gap-3 text-sm font-medium text-[#404840]">
                  <Mountain
                    size={19}
                    className="shrink-0 text-[#52724F]"
                  />
                  {t('europeanEvents')}
                </div>

                <div className="flex items-center gap-3 text-sm font-medium text-[#404840]">
                  <Compass
                    size={19}
                    className="shrink-0 text-[#52724F]"
                  />
                  {t('portrait')}
                </div>

                <div className="flex items-center gap-3 text-sm font-medium text-[#404840]">
                  <Check
                    size={19}
                    className="shrink-0 text-[#52724F]"
                  />
                  {t('wallCalendar')}
                </div>

              </div>


              {/* PREIS UND KAUFAKTION */}
              <div className="mt-8">

                <div className="flex flex-wrap items-end gap-x-4 gap-y-2">

                  <div className="text-[42px] font-extrabold leading-none tracking-tight text-[#20241F]">
                    29,90 €
                  </div>

                  
                <div className="pb-1 text-sm text-[#777B73]">
                    {t('vat')}
                </div>

                </div>

                <p className="mt-2 text-sm text-[#777B73]">
                  {t('shippingExtra')}
                </p>


                {/* Hauptbutton */}
                <Link
                  href="/shop/schorschys-wanderkalender-2027"
                  className="mt-7 flex min-h-[58px] w-full items-center justify-center gap-3 rounded-lg bg-[#244B36] px-8 py-4 text-base font-bold text-white shadow-[0_8px_20px_rgba(36,75,54,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#326747] hover:shadow-[0_12px_25px_rgba(36,75,54,0.25)]"
                >
                  {t('discover')}
                  <ArrowRight size={20} />
                </Link>

                <p className="mt-4 text-center text-xs text-[#777B73]">
                  {t('moreDetails')}
                </p>

              </div>

            </div>

          </div>

        </section>


        {/* =====================================================
            SERVICELEISTE
        ===================================================== */}

        <section className="grid overflow-hidden rounded-lg border border-white/10 bg-[#222521] md:grid-cols-3">

          {/* Markenwert */}
          <div className="flex items-start gap-4 border-b border-white/10 p-6 md:border-b-0 md:border-r">

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#344A36] text-[#B7D49A]">
              <Compass size={23} />
            </div>

            <div>
              <h3 className="text-sm font-bold text-white">
                {ui('outdoorAdventureLabel')}
              </h3>

              <p className="mt-2 text-sm leading-6 text-stone-400">
                {t('adventureProducts')}
              </p>
            </div>

          </div>


          {/* Versand */}
          <div className="flex items-start gap-4 border-b border-white/10 p-6 md:border-b-0 md:border-r">

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#344A36] text-[#B7D49A]">
              <Truck size={23} />
            </div>

            <div>
              <h3 className="text-sm font-bold text-white">
                {t('direct')}
              </h3>

              <p className="mt-2 text-sm leading-6 text-stone-400">
                {t('delivery')}
              </p>
            </div>

          </div>


          {/* Bestellabwicklung */}
          <div className="flex items-start gap-4 p-6">

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#344A36] text-[#B7D49A]">
              <ShieldCheck size={23} />
            </div>

            <div>
              <h3 className="text-sm font-bold text-white">
                {t('secure')}
              </h3>

              <p className="mt-2 text-sm leading-6 text-stone-400">
                {t('orderProcess')}
              </p>
            </div>

          </div>

        </section>

      </div>

    </main>
  )
}