import { supabase } from './supabase'

export type ActivePartnerBooking = {
  id: string
  partner_id: string
  booking_type: 'event_partner' | 'brand_partner'
  package_code: string
  package_name: string
  duration_days: number | null
  start_date: string
  end_date: string
  target_url: string | null
  banner_url: string | null
  logo_url: string | null
  custom_text: string | null
  status: 'active'
  notes: string | null
  partners?: {
    name: string
    website_url: string | null
    logo_url: string | null
  } | null
}

export async function getActivePartnerBookings() {
  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('partner_bookings')
    .select(
      'id, partner_id, booking_type, package_code, package_name, duration_days, start_date, end_date, target_url, banner_url, logo_url, custom_text, status, notes, partners(name, website_url, logo_url)'
    )
    .eq('status', 'active')
    .lte('start_date', today)
    .gte('end_date', today)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getActivePartnerBookings error:', error.message)
    return []
  }

  return ((data ?? []) as any[]).map((row) => ({
    ...row,
    partners: Array.isArray(row.partners)
      ? row.partners[0] ?? null
      : row.partners ?? null,
  })) as ActivePartnerBooking[]
}