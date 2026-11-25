'use client'
import { useLocale, useTranslations } from 'next-intl'
import { storeTagline } from '@/i18n/polish-store'
import Link from '@/i18n/prototype/LocalizedLink'
import { useEffect, useState } from 'react'
export default function OrderStatus() {
  const locale = useLocale()
  const t = useTranslations('orderStatus')
  const [status, setStatus] = useState('checking'), [message, setMessage] = useState<keyof typeof import('../../../messages/en.json')['orderStatus']>('checking'), [orderId, setOrderId] = useState('')
  useEffect(() => {
    let stopped = false, timer: ReturnType<typeof setTimeout> | undefined, polls = 0
    const query = new URLSearchParams(window.location.search), order = query.get('order')
    if (!order) { setStatus('error'); setMessage('invalid'); return }
    setOrderId(order)
    async function check() {
      try {
        const response = await fetch(`/api/shop/order?order=${encodeURIComponent(order!)}`, { cache: 'no-store' })
        const result = await response.json()
        if (!response.ok) {
          if ((response.status >= 500 || response.status === 429) && ++polls < 20) {
            if (!stopped) { setMessage('checkingConfirmation'); timer = setTimeout(check, 3000) }
            return
          }
          throw new Error('Der Bestellstatus ist gerade nicht abrufbar. Bitte zahle nicht erneut und lade diese Seite später neu.')
        }
        if (stopped) return
        setStatus(result.status)
        if (result.status === 'paid') { setMessage(result.totalCents === 0 ? 'freeConfirmedMessage' : 'confirmedMessage'); return }
        if (result.status !== 'pending') { setMessage('contactSupport'); return }
        setMessage('waiting')
        if (++polls < 20) timer = setTimeout(check, 3000)
        else setMessage('stillWaiting')
      } catch {
        if (!stopped) {
          if (++polls < 20) { setMessage('checkingConfirmation'); timer = setTimeout(check, 3000) }
          else { setStatus('error'); setMessage('unavailable') }
        }
      }
    }
    async function start() {
      if (query.get('paypal') === '1') {
        try {
          const response = await fetch('/api/shop/paypal/return', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order }) })
          if (!response.ok) { const result = await response.json(); throw new Error(result.error) }
        } catch { if (!stopped) setMessage('stillChecking') }
      }
      if (!stopped) await check()
    }
    void start(); return () => { stopped = true; if (timer) clearTimeout(timer) }
  }, [])
  return <main className="min-h-screen bg-[#141312] px-5 py-12 text-stone-100 sm:py-16">
    <section className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
      <header className="flex items-center gap-5 border-b border-white/10 px-6 py-6 sm:px-8">
        <Link href="/shop" aria-label={t('store')} className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ultimate-logo-transparent-weiss.png" alt="ULTIMATE" className="h-16 w-16 object-contain sm:h-20 sm:w-20" />
        </Link>
        <div><p className="text-xs font-semibold tracking-[0.18em] text-emerald-300 sm:text-sm">ULTIMATE OUTDOOR STORE</p><p className="mt-2 text-sm text-stone-400">{storeTagline(locale)}</p></div>
      </header>
      <div className="p-6 sm:p-8">
        {status === 'paid' && <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-sm text-emerald-300"><span aria-hidden="true">✓</span> {t('confirmed')}</div>}
        <h1 className="text-3xl font-bold">{status === 'paid' ? t('thankYou') : t('yourOrder')}</h1>
        <p role="status" className="mt-5 leading-7 text-stone-200">{t(message)}</p>
        {orderId && <div className="mt-6 rounded-lg bg-white/5 p-4"><p className="text-xs uppercase tracking-wider text-stone-400">{t('number')}</p><p className="mt-2 break-all text-sm text-stone-200">{orderId}</p></div>}
        {status === 'paid' && <a href={`/api/shop/invoice?order=${encodeURIComponent(orderId)}`} className="mt-6 mr-4 inline-flex rounded-lg border border-emerald-300/30 px-5 py-3 font-semibold text-emerald-200 hover:bg-white/5">{t('download')}</a>}
        <Link className="mt-8 inline-flex rounded-lg bg-[#527052] px-5 py-3 font-semibold text-white transition hover:bg-[#628262]" href="/shop">{t('back')}</Link>
      </div>
    </section>
  </main>
}
