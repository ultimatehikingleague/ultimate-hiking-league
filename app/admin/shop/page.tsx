'use client'

import Link from 'next/link'
import InvoiceBackupButton from './InvoiceBackupButton'
import type { AdminMetrics } from '../../lib/shop/admin-metrics'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  ArrowLeft,
  Boxes,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Package,
  Settings,
  Truck,
  Ticket,
  Users,
} from 'lucide-react'

const adminSections = [
  {
    title: 'Produkte',
    description: 'Produkte, Bilder und Lagerbestände verwalten.',
    href: '/admin/shop/products',
    action: 'Produkte öffnen',
    icon: Package,
  },
  {
    title: 'Gutscheine',
    description: 'Rabattcodes erstellen und Einlösungen einsehen.',
    href: '/admin/shop/vouchers',
    action: 'Gutscheine öffnen',
    icon: Ticket,
  },
  {
    title: 'Bestellungen',
    description: 'Bestelleingänge und Bearbeitungsstatus überwachen.',
    href: '/admin/shop/orders',
    action: 'Bestellungen öffnen',
    icon: ClipboardList,
  },
  {
    title: 'Kunden',
    description: 'Kundeninformationen und Bestellhistorie verwalten.',
    icon: Users,
  },
  {
    title: 'Versand',
    description: 'Versandarten, Tarife und Versandzonen verwalten.',
    href: '/admin/shop/shipping',
    action: 'Versandarten öffnen',
    icon: Truck,
  },
  {
    title: 'Rechnungen',
    description: 'Rechnungsstellung und Zahlungsübersicht.',
    icon: CreditCard,
  },
  {
    title: 'Lager & Varianten',
    description: 'Bestände, Größen und Farben verwalten.',
    icon: Boxes,
  },
  {
    title: 'Einstellungen',
    description: 'Shopkonfiguration und Versandoptionen.',
    icon: Settings,
  },
]

export default function ShopAdminPage() {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [metricsError, setMetricsError] = useState('')

  useEffect(() => {
    async function checkAdmin() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          setIsAdmin(false)
          return
        }

        const { data, error } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle()

        setIsAdmin(!error && !!data)
        if (!error && data) {
          const session = await supabase.auth.getSession()
          const response = await fetch('/api/admin/shop/metrics', { headers: { Authorization: 'Bearer ' + (session.data.session?.access_token || '') }, cache: 'no-store' })
          if (!response.ok) { setMetricsError('Kennzahlen konnten nicht geladen werden.'); return }
          setMetrics(await response.json())
        }
      } catch {
        setMetricsError('Kennzahlen konnten nicht geladen werden.')
      } finally {
        setLoading(false)
      }
    }

    void checkAdmin()
  }, [])

  if (loading) {
    return (
      <main className="min-h-screen bg-[#141312] p-10 text-white">
        Shop-Administration wird geladen …
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-[#141312] p-10 text-white">
        <h1 className="text-2xl font-bold">Kein Zugriff</h1>
        <p className="mt-3 text-stone-400">
          Dieser Bereich ist nur für Administratoren verfügbar.
        </p>
        <Link href="/admin" className="mt-6 inline-block underline">
          Zurück
        </Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#141312] px-6 py-12 text-white md:px-10">
      <div className="mx-auto max-w-7xl">

        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm text-stone-400 transition hover:text-white"
        >
          <ArrowLeft size={17} />
          Zurück zur UHL-Administration
        </Link>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.03] p-7 md:p-10">

          <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.24em] text-emerald-300">
            <LayoutDashboard size={20} />
            ULTIMATE OUTDOOR STORE
          </div>

          <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
            Shop-Administration
          </h1>

          <p className="mt-4 max-w-2xl text-stone-400">
            Zentrale Verwaltung für Produkte, Bestellungen,
            Kunden, Versand und Rechnungen.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Bestellungen heute', value: metrics?.paidToday ?? 'Nicht verfügbar' },
              { label: 'Offene Bestellungen', value: metrics ? metrics.openOrders ?? 'Nicht vollständig ermittelbar' : 'Nicht verfügbar' },
              { label: 'Umsatz gesamt', value: metrics ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(metrics.revenueCents / 100) : 'Nicht verfügbar' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-white/10 bg-black/15 p-5"
              >
                <div className="text-xs uppercase tracking-[0.15em] text-stone-500">
                  {stat.label}
                </div>
                <div className="mt-3 text-3xl font-bold">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
          {metricsError && <p role="alert" className="mt-4 text-red-300">{metricsError}</p>}
          <div className="mt-5 space-y-2 text-sm leading-6 text-stone-400">
            <p>Heute zählen bestätigte, nicht als erstattet gespeicherte LIVE-Bestellungen nach Berliner Zeit.</p>
            <p>Der Umsatz enthält bestätigte LIVE-Zahlungen einschließlich Versand. Gespeicherte Vollerstattungen sind abgezogen. Teilrückzahlungen und noch nicht erfasste Erstattungen fehlen. Zahlungen aus der TEST-Umgebung sind ausgeschlossen. Eigene Käufe in der LIVE-Umgebung lassen sich derzeit nicht unterscheiden.</p>
            {metrics && metrics.unknownFulfillment > 0 && <p>
              Sicher offen: {metrics.knownOpen}. Ohne eindeutigen Fulfillment-Status: {metrics.unknownFulfillment}.
            </p>}
            {metrics && <p>Stand: {new Date(metrics.checkedAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })} · Erfasste Vollerstattungen: {metrics.refundedRecords}.</p>}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">
            Verwaltung
          </h2>

          <p className="mt-2 text-sm text-stone-400">
            Wähle einen Bereich aus, um ihn zu verwalten.
          </p>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {adminSections.map((section) => {
              const Icon = section.icon

              return (
                <div
                  key={section.title}
                  className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300">
                    <Icon size={23} />
                  </div>

                  <h3 className="mt-5 text-xl font-semibold">
                    {section.title}
                  </h3>

                  <p className="mt-2 min-h-[48px] text-sm leading-6 text-stone-400">
                    {section.description}
                  </p>

                  {section.title === 'Rechnungen' ? <InvoiceBackupButton /> : section.href ? (
                    <Link href={section.href} className="mt-5 inline-block font-semibold text-emerald-300 underline">{section.action} →</Link>
                  ) : <div className="mt-5 text-xs font-semibold uppercase tracking-wider text-stone-500">In Vorbereitung</div>}
                </div>
              )
            })}
          </div>
        </section>

      </div>
    </main>
  )
}