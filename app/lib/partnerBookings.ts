import { supabase } from './supabase'

export type PartnerSurface = 'home' | 'rankings' | 'profile' | 'account' | 'footer' | 'events' | 'milestone'

export type PartnerAd = {
  booking_id: string
  booking_type: 'brand_partner' | 'event_partner'
  package_code: string
  partner_name: string
  banner_url: string | null
  logo_url: string | null
  target_url: string | null
  custom_text: string | null
  event_id: number | null
  event_slug: string | null
  event_title: string | null
}

export async function getPartnerAds(surface: PartnerSurface) {
  const { data, error } = await supabase.rpc('uhl_partner_ads', { p_surface: surface })
  if (error) return []
  return (data ?? []) as PartnerAd[]
}

export function eventAdIndex(ads: PartnerAd[]) {
  const indexed = new Map<number, PartnerAd[]>()
  for (const ad of ads) {
    if (ad.event_id === null) continue
    const placed = indexed.get(ad.event_id) ?? []
    placed.push(ad)
    indexed.set(ad.event_id, placed)
  }
  for (const placed of indexed.values()) placed.sort((a, b) => b.package_code.localeCompare(a.package_code))
  return indexed
}
