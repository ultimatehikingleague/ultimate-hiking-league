'use client'

import { useLocale, useTranslations } from 'next-intl'
import Link from '@/i18n/prototype/LocalizedLink'
import { useEffect, useState, type ReactNode } from 'react'
import { getPartnerAds, type PartnerAd, type PartnerSurface } from '../lib/partnerBookings'
import { supabase } from '../lib/supabase'

export function BrandAd({ ad, footer = false }: { ad: PartnerAd; footer?: boolean }) {
  const t = useTranslations('ui')
  const image = footer ? ad.logo_url : ad.banner_url
  if (!image || !ad.target_url) return null
  return (
    <aside aria-label={t('adBy', { name: ad.partner_name })} className="min-w-0 rounded-2xl border border-emerald-200/25 bg-[#213125] p-3 text-stone-100">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="font-semibold uppercase tracking-wide text-emerald-100">{t("advertising")}</span>
        {ad.package_code === 'F' && <span className="font-semibold text-amber-200">{t('officialPartnerBadge')}</span>}
      </div>
      <a href={ad.target_url} target="_blank" rel="noopener noreferrer sponsored"
        aria-label={t('openPartner', { name: ad.partner_name })} className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4">
        <img src={image} alt={ad.partner_name} loading="lazy" decoding="async"
          className={footer ? 'h-10 max-w-full object-contain' : 'h-20 w-full object-contain md:h-24'} />
      </a>
    </aside>
  )
}

export function EventSponsor({ ad, compact = false }: { ad: PartnerAd; compact?: boolean }) {
  const t = useTranslations('ui')
  return (
    <div aria-label={t('adBy', { name: ad.partner_name })} className="grid min-w-0 gap-2 text-sm text-stone-100">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="font-semibold uppercase tracking-wide text-emerald-100">{t("advertising")}</span>
        {ad.package_code === 'D' && <span className="rounded-full border border-amber-200/40 px-2 py-1 font-semibold text-amber-200">{t("officialEventPartner")}</span>}
      </div>
      {ad.logo_url && (ad.target_url?.startsWith('https://') ? (
        <a href={ad.target_url} target="_blank" rel="noopener noreferrer sponsored"
          aria-label={t('openPartner', { name: ad.partner_name })}
          className="w-fit max-w-full rounded focus-visible:outline-2 focus-visible:outline-offset-4">
          <img src={ad.logo_url} alt={ad.partner_name} loading="lazy" decoding="async" className="h-9 max-w-full object-contain object-left" />
        </a>
      ) : <img src={ad.logo_url} alt={ad.partner_name} loading="lazy" decoding="async" className="h-9 max-w-full object-contain object-left" />)}
      <p className={'whitespace-pre-line break-words text-stone-200' + (compact ? ' line-clamp-2' : '')}>{ad.custom_text}</p>
    </div>
  )
}

export function EventAd({ ad, link = false }: { ad: PartnerAd; link?: boolean }) {
  const t = useTranslations('ui')
  return (
    <aside className={'rounded-2xl border p-3 ' + (ad.package_code === 'D'
      ? 'border-amber-200/50 bg-[#372e1d]' : 'border-emerald-200/25 bg-[#213125]')}>
      <EventSponsor ad={ad} compact={link} />
      {link && ad.event_slug && (
        <Link href={'/events/' + encodeURIComponent(ad.event_slug)} className="mt-2 inline-block break-words font-semibold text-white underline underline-offset-4">
          {ad.event_title ?? t('openEvent')} →
        </Link>
      )}
    </aside>
  )
}

function AdRotation({ count, label, auto = false, children }: {
  count: number
  label: string
  auto?: boolean
  children: (index: number) => ReactNode
}) {
  const t = useTranslations('ui')
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [pointerInside, setPointerInside] = useState(false)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!auto || count < 2 || paused || pointerInside || focused || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex(current => (current + 1) % count)
    }, 9000)
    return () => window.clearInterval(timer)
  }, [auto, count, paused, pointerInside, focused])

  if (!count) return null
  return (
    <section aria-label={label} onPointerEnter={() => setPointerInside(true)} onPointerLeave={() => setPointerInside(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
      {children(index % count)}
      {count > 1 && (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-3 text-xs text-stone-200">
          {auto && <button type="button" className="rounded-full border border-white/25 px-3 py-1.5"
            onClick={() => setPaused(value => !value)}>{paused ? t("startRotation") : t("pauseRotation")}</button>}
          <button type="button" className="rounded-full border border-white/25 px-3 py-1.5"
            onClick={() => setIndex(current => (current + 1) % count)}>
            {t('nextAd', { current: (index % count) + 1, count })}
          </button>
        </div>
      )}
    </section>
  )
}

export function EventSponsors({ ads, detail = false }: { ads: PartnerAd[]; detail?: boolean }) {
  const t = useTranslations('ui')
  return (
    <AdRotation count={ads.length} label={t('eventPartners')}>
      {index => detail ? <EventAd ad={ads[index]} /> : <EventSponsor ad={ads[index]} />}
    </AdRotation>
  )
}

export function HomePartnerPlacements({ ads }: { ads: PartnerAd[] }) {
  const t = useTranslations('ui')
  const locale = useLocale()
  const official = ads.filter(ad => ad.booking_type === 'brand_partner' && ad.package_code === 'F')
  const premium = ads.filter(ad => ad.booking_type === 'brand_partner' && ad.package_code === 'E').slice(0, 3)
  const events = ads.filter(ad => ad.booking_type === 'event_partner' && ad.package_code !== 'D')
  const mainEvents = ads.filter(ad => ad.booking_type === 'event_partner' && ad.package_code === 'D')
  if (official.length + premium.length + events.length + mainEvents.length === 0) return null

  return (
    <div className="mt-5 grid min-w-0 gap-3">
      <BrandPlacement ads={official} label={t('officialBrandPartners')} />
      {premium.length > 0 && <>
        <div className="hidden grid-cols-3 gap-3 md:grid">
          {premium.map(ad => <BrandAd key={ad.booking_id} ad={ad} />)}
        </div>
        <div className="md:hidden">
          <AdRotation count={premium.length} label={t('premiumBrandPartners')}>
            {index => <BrandAd ad={premium[index]} />}
          </AdRotation>
        </div>
      </>}
      {(mainEvents.length > 0 || events.length > 0) && (
        <div className={'grid gap-3' + (mainEvents.length > 0 && events.length > 0 ? ' md:grid-cols-2' : '')}>
          <AdRotation count={mainEvents.length} label={(locale === 'pl' || locale === 'it' || locale === 'es' || locale === 'cs') ? t('officialEventPartner') : "Main Event Partner"} auto>
            {index => <EventAd ad={mainEvents[index]} link />}
          </AdRotation>
          <AdRotation count={events.length} label={t('promotedEvents')} auto>
            {index => <EventAd ad={events[index]} link />}
          </AdRotation>
        </div>
      )}
    </div>
  )
}

export function BrandPlacement({ ads, label, footer = false }: {
  ads: PartnerAd[]
  label?: string
  footer?: boolean
}) {
  const t = useTranslations('ui')
  if (ads.length === 0) return null
  return (
    <AdRotation count={ads.length} label={label ?? t('advertisingPartners')} auto>
      {index => <BrandAd ad={ads[index]} footer={footer} />}
    </AdRotation>
  )
}

function useLivePartnerAds(surface: PartnerSurface) {
  const [ads, setAds] = useState<PartnerAd[]>([])
  useEffect(() => {
    let mounted = true
    const refresh = () => void getPartnerAds(surface).then(rows => { if (mounted) setAds(rows) })
    const auth = surface === 'account' ? supabase.auth.onAuthStateChange(() => { window.setTimeout(refresh, 0) }) : null
    refresh()
    const timer = window.setInterval(refresh, 60_000)
    return () => {
      mounted = false
      auth?.data.subscription.unsubscribe()
      window.clearInterval(timer)
    }
  }, [surface])
  return ads
}

export function MilestonePartners() {
  const ads = useLivePartnerAds('milestone').flatMap(ad =>
    ad.logo_url && ad.target_url ? [{ id: ad.booking_id, logo: ad.logo_url, url: ad.target_url, name: ad.partner_name }] : [])
  if (!ads.length) return null

  return (
    <section aria-labelledby="milestone-partners-heading" className="bg-[#171f19] px-6 py-8 text-stone-100">
      <div className="mx-auto max-w-6xl">
        <h2 id="milestone-partners-heading" className="mb-4 text-lg font-semibold text-emerald-100">Milestone-Partner</h2>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,12rem),1fr))] gap-3">
          {ads.map(ad => (
            <li key={ad.id}>
              <a href={ad.url} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 p-3 text-center text-sm hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4">
                <img src={ad.logo} alt="" width="144" height="40" loading="lazy" decoding="async"
                  className="h-10 w-36 max-w-full object-contain" />
                <span className="break-words">{ad.name}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function LiveBrandPlacement({ surface }: { surface: Extract<PartnerSurface, 'rankings' | 'account' | 'footer'> }) {
  const t = useTranslations('ui')
  const ads = useLivePartnerAds(surface)
  if (!ads.length) return null
  const label = surface === 'account' ? t("memberAdvertising") :
    surface === 'footer' ? t("footerPartners") : t("rankingsAdvertising")
  return <div className="mb-5"><BrandPlacement ads={ads} label={label} footer={surface === 'footer'} /></div>
}
