'use client'

import Link from 'next/link'
import { bookingPriceInput, parseBookingPrice } from '../../lib/partners/price'
import PartnerDocuments from './PartnerDocuments'
import { useEffect, useState } from 'react'
import ProfileBrandBar from '../../components/ProfileBrandBar'
import { getDurationOptions, getPartnerPackageName, getPartnerPackages, packageEndDate } from '../../lib/partners/packages'
import { supabase } from '../../lib/supabase'

type AdminUserRow = { user_id: string; email: string | null }

type Partner = {
  id: string
  name: string
  partner_type: 'event_partner' | 'brand_partner' | 'both'
  contact_name: string | null
  contact_email: string | null
  website_url: string | null
  logo_url: string | null
  notes: string | null
  created_at: string | null
}

type PartnerBooking = {
  id: string
  partner_id: string
  booking_type: 'event_partner' | 'brand_partner'
  package_code: string
  package_name: string
  duration_days: number | null
  agreed_price_cents: number | null
  list_price_cents: number | null
  start_date: string
  end_date: string
  target_url: string | null
  banner_url: string | null
  logo_url: string | null
  custom_text: string | null
  status: 'draft' | 'active' | 'paused' | 'expired'
  notes: string | null
  created_at: string | null
  partners?: {
    name: string
  } | null
}

type PartnerBookingRow = Omit<PartnerBooking, 'partners'> & {
  partners?: PartnerBooking['partners'] | { name: string }[]
}

function normalizeBooking(row: PartnerBookingRow): PartnerBooking {
  return {
    ...row,
    partners: Array.isArray(row.partners) ? row.partners[0] ?? null : row.partners ?? null,
  }
}

function errorMessage(error: unknown): string {
  return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message
    : 'Unbekannt'
}

type PartnerFormState = {
  name: string
  partner_type: 'event_partner' | 'brand_partner' | 'both'
  contact_name: string
  contact_email: string
  website_url: string
  logo_url: string
  notes: string
}

const emptyPartnerForm: PartnerFormState = {
  name: '',
  partner_type: 'event_partner',
  contact_name: '',
  contact_email: '',
  website_url: '',
  logo_url: '',
  notes: '',
}

type PartnerBookingFormState = {
  partner_id: string
  booking_type: 'event_partner' | 'brand_partner'
  package_code: string
  duration_days: string
  price: string | null
  start_date: string
  end_date: string
  target_url: string
  banner_url: string
  logo_url: string
  custom_text: string
  notes: string
}

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

function formatDurationLabel(days: number) {
  if (days === 365) return '12 Monate'
  return `${days} Tage`
}

export default function PartnerAdminPage() {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [partners, setPartners] = useState<Partner[]>([])
  const [partnerBookings, setPartnerBookings] = useState<PartnerBooking[]>([])
  const [partnerLoading, setPartnerLoading] = useState(false)
  const [partnerMessage, setPartnerMessage] = useState('')
  const [documentBookingId, setDocumentBookingId] = useState<string | null>(null)
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null)

  const [bookingEditForm, setBookingEditForm] = useState({
    price: '',
    start_date: '',
    end_date: '',
    target_url: '',
    banner_url: '',
    logo_url: '',
    custom_text: '',
    notes: '',
  })

  const [partnerForm, setPartnerForm] = useState(emptyPartnerForm)
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null)

  const [partnerBookingForm, setPartnerBookingForm] =
    useState<PartnerBookingFormState>({
      partner_id: '',
      booking_type: 'event_partner',
      package_code: 'A',
      duration_days: '7',
      price: null,
      start_date: '',
      end_date: '',
      target_url: '',
      banner_url: '',
      logo_url: '',
      custom_text: '',
      notes: '',
    })

  const milestone = partnerBookingForm.booking_type === 'brand_partner' && partnerBookingForm.package_code === 'M'
  const suggestedPrice = milestone ? 0 : getPartnerPackages(partnerBookingForm.booking_type)
    .find(item => item.code === partnerBookingForm.package_code)
    ?.offers.find(offer => String(offer.days) === partnerBookingForm.duration_days)?.cents ?? null

  useEffect(() => {
    async function loadPartners() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session?.user) {
          window.location.href = '/login'
          return
        }

        const { data: adminRow, error: adminError } = await supabase
          .from('admin_users')
          .select('user_id, email')
          .eq('user_id', session.user.id)
          .maybeSingle<AdminUserRow>()

        if (adminError || !adminRow) {
          setIsAdmin(false)
          setLoading(false)
          return
        }

        setIsAdmin(true)

        const [
          { data: partnerRows, error: partnersError },
          { data: bookingRows, error: bookingsError },
        ] = await Promise.all([
          supabase
            .from('partners')
            .select(
              'id, name, partner_type, contact_name, contact_email, website_url, logo_url, notes, created_at'
            )
            .order('created_at', { ascending: false }),
          supabase
            .from('partner_bookings')
            .select(
              'id, partner_id, booking_type, package_code, package_name, duration_days, agreed_price_cents, list_price_cents, start_date, end_date, target_url, banner_url, logo_url, custom_text, status, notes, created_at, partners(name)'
            )
            .order('created_at', { ascending: false }),
        ])

        if (partnersError || bookingsError) {
          setPartnerMessage('Partner oder Buchungen konnten nicht vollständig geladen werden.')
        }
        if (!partnersError && partnerRows) {
          setPartners(partnerRows as Partner[])
        }

        if (!bookingsError && bookingRows) {
          setPartnerBookings((bookingRows as PartnerBookingRow[]).map(normalizeBooking))
        }

      } catch (error) {
        console.error('Partner admin load error:', error)
        setPartnerMessage('Partnerverwaltung konnte nicht geladen werden.')
      } finally {
        setLoading(false)
      }
    }

    void loadPartners()
  }, [])

    function updatePartnerForm(
    field: keyof PartnerFormState,
    value: string
  ) {
    setPartnerForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  function updatePartnerBookingForm(
    field: keyof PartnerBookingFormState,
    value: string
  ) {
    setPartnerBookingForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  async function handleUploadPartnerBookingAsset(
    file: File | undefined,
    field: 'banner_url' | 'logo_url'
  ) {
    if (!file) return

    setLogoUploading(true)
    setPartnerMessage('')

    try {
      const safeFileName = file.name
        .toLowerCase()
        .replace(/[^a-z0-9.-]+/g, '-')

      const folder = field === 'banner_url' ? 'banners' : 'logos'
      const filePath = `bookings/${folder}/${Date.now()}-${safeFileName}`

      const { error: uploadError } = await supabase.storage
        .from('partner-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        setPartnerMessage(`Upload fehlgeschlagen: ${uploadError.message}`)
        return
      }

      const { data } = supabase.storage
        .from('partner-assets')
        .getPublicUrl(filePath)

      updatePartnerBookingForm(field, data.publicUrl)
      setPartnerMessage('Datei wurde hochgeladen und die URL eingetragen.')
    } catch (error) {
      setPartnerMessage(`Upload-Fehler: ${errorMessage(error)}`)
    } finally {
      setLogoUploading(false)
    }
  }

  async function uploadPartnerAsset(
  file: File,
  folder: 'logos' | 'banners'
) {
  setLogoUploading(true)
  setPartnerMessage('')

  try {
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'file'
    const safeName = file.name
      .replace(/\.[^/.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    const filePath = `${folder}/${Date.now()}-${safeName}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('partner-assets')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      setPartnerMessage(`Upload fehlgeschlagen: ${uploadError.message}`)
      return null
    }

    const { data } = supabase.storage
      .from('partner-assets')
      .getPublicUrl(filePath)

    return data.publicUrl
  } catch (error) {
    setPartnerMessage(`Upload-Fehler: ${errorMessage(error)}`)
    return null
  } finally {
    setLogoUploading(false)
  }
}

  function startEditPartner(partner: Partner) {
    setEditingPartnerId(partner.id)
    setPartnerForm({
      name: partner.name,
      partner_type: partner.partner_type,
      contact_name: partner.contact_name ?? '',
      contact_email: partner.contact_email ?? '',
      website_url: partner.website_url ?? '',
      logo_url: partner.logo_url ?? '',
      notes: partner.notes ?? '',
    })
    document.getElementById('partner-form')?.scrollIntoView({ block: 'start' })
  }

  function resetPartnerForm() {
    setEditingPartnerId(null)
    setPartnerForm(emptyPartnerForm)
  }

  async function handleSavePartner() {
    setPartnerLoading(true)
    setPartnerMessage('')

    try {
      if (!partnerForm.name.trim()) {
        setPartnerMessage('Bitte Partnername angeben.')
        return
      }

      const values = {
        name: partnerForm.name.trim(),
        partner_type: partnerForm.partner_type,
        contact_name: partnerForm.contact_name.trim() || null,
        contact_email: partnerForm.contact_email.trim() || null,
        website_url: partnerForm.website_url.trim() || null,
        logo_url: partnerForm.logo_url.trim() || null,
        notes: partnerForm.notes.trim() || null,
      }
      const table = supabase.from('partners')
      const save = editingPartnerId ? table.update(values).eq('id', editingPartnerId) : table.insert(values)
      const { data, error } = await save
        .select('id, name, partner_type, contact_name, contact_email, website_url, logo_url, notes, created_at')
        .single()

      if (error || !data) {
        setPartnerMessage(`Fehler beim Speichern des Partners: ${error?.message ?? 'Unbekannt'}`)
        return
      }

      const saved = data as Partner
      setPartners(prev => editingPartnerId ? prev.map(partner => partner.id === saved.id ? saved : partner) : [saved, ...prev])
      if (editingPartnerId) {
        setPartnerBookings(prev => prev.map(booking => booking.partner_id === saved.id
          ? { ...booking, partners: { name: saved.name } } : booking))
      }
      resetPartnerForm()
      setPartnerMessage(editingPartnerId ? 'Partner wurde aktualisiert.' : 'Partner wurde angelegt.')
    } catch (error) {
      setPartnerMessage(`Fehler: ${errorMessage(error)}`)
    } finally {
      setPartnerLoading(false)
    }
  }

  async function handleCreatePartnerBooking() {
    setPartnerLoading(true)
    setPartnerMessage('')

    try {
      if (!partnerBookingForm.partner_id) {
        setPartnerMessage('Bitte Partner auswählen.')
        return
      }

      if (!partnerBookingForm.start_date || !partnerBookingForm.end_date || partnerBookingForm.end_date < partnerBookingForm.start_date) {
        setPartnerMessage('Bitte Start- und Enddatum angeben.')
        return
      }

      const agreedPrice = parseBookingPrice(partnerBookingForm.price ?? bookingPriceInput(suggestedPrice))
      if (agreedPrice === null || (milestone && agreedPrice !== 0)) {
        setPartnerMessage(milestone ? 'Die Milestone-Präsenz ist kostenlos.' : 'Bitte einen gültigen Buchungspreis in Euro eingeben.')
        return
      }
      const partner = partners.find(item => item.id === partnerBookingForm.partner_id)
      const logo = partnerBookingForm.logo_url.trim() || (milestone ? partner?.logo_url : null)
      const target = partnerBookingForm.target_url.trim() || (milestone ? partner?.website_url : null)
      if (milestone && (!logo?.startsWith('https://') || !target?.startsWith('https://'))) {
        setPartnerMessage('Bitte Logo und Ziel-Link zur Milestone-Präsenz als HTTPS-Adressen hinterlegen.')
        return
      }

      const packageName = getPartnerPackageName(
        partnerBookingForm.booking_type,
        partnerBookingForm.package_code
      )

      const { data, error } = await supabase
        .from('partner_bookings')
        .insert({
          partner_id: partnerBookingForm.partner_id,
          booking_type: partnerBookingForm.booking_type,
          package_code: partnerBookingForm.package_code,
          package_name: packageName,
          duration_days: milestone ? null : Number(partnerBookingForm.duration_days),
          agreed_price_cents: agreedPrice,
          list_price_cents: suggestedPrice,
          start_date: partnerBookingForm.start_date,
          end_date: partnerBookingForm.end_date,
          target_url: target || null,
          banner_url: partnerBookingForm.banner_url.trim() || null,
          logo_url: logo || null,
          custom_text: partnerBookingForm.custom_text.trim() || null,
          notes: partnerBookingForm.notes.trim() || null,
          status: 'draft',
        })
        .select(
          'id, partner_id, booking_type, package_code, package_name, duration_days, agreed_price_cents, list_price_cents, start_date, end_date, target_url, banner_url, logo_url, custom_text, status, notes, created_at, partners(name)'
        )
        .single()

      if (error || !data) {
        setPartnerMessage(`Fehler beim Anlegen der Buchung: ${error?.message ?? 'Unbekannt'}`)
        return
      }

      const normalizedBooking = normalizeBooking(data as PartnerBookingRow)

      setPartnerBookings((prev) => [normalizedBooking, ...prev])

      setPartnerBookingForm({
        partner_id: '',
        booking_type: 'event_partner',
        package_code: 'A',
        duration_days: '7',
        price: null,
        start_date: '',
        end_date: '',
        target_url: '',
        banner_url: '',
        logo_url: '',
        custom_text: '',
        notes: '',
      })

      setPartnerMessage('Buchungsentwurf wurde angelegt. Angebote und Kooperationen findest du unter „Unterlagen“.')
    } catch (error) {
      setPartnerMessage(`Fehler: ${errorMessage(error)}`)
    } finally {
      setPartnerLoading(false)
    }
  }

  function startEditBooking(booking: PartnerBooking) {
  setEditingBookingId(booking.id)

  setBookingEditForm({
    price: '',
    start_date: booking.start_date ?? '',
    end_date: booking.end_date ?? '',
    target_url: booking.target_url ?? '',
    banner_url: booking.banner_url ?? '',
    logo_url: booking.logo_url ?? '',
    custom_text: booking.custom_text ?? '',
    notes: booking.notes ?? '',
  })
}

function cancelEditBooking() {
  setEditingBookingId(null)

  setBookingEditForm({
    price: '',
    start_date: '',
    end_date: '',
    target_url: '',
    banner_url: '',
    logo_url: '',
    custom_text: '',
    notes: '',
  })
}

function updateBookingEditForm(field: keyof typeof bookingEditForm, value: string) {
  setBookingEditForm((prev) => ({
    ...prev,
    [field]: value,
  }))
}

async function handleUpdatePartnerBooking(bookingId: string) {
  setPartnerLoading(true)
  setPartnerMessage('')

  try {
    const agreedPrice = parseBookingPrice(bookingEditForm.price)
    if (bookingEditForm.price !== '' && agreedPrice === null) {
      setPartnerMessage('Bitte einen gültigen Buchungspreis in Euro eingeben.')
      return
    }
    const { data, error } = await supabase
      .from('partner_bookings')
      .update({
        ...(agreedPrice !== null && { agreed_price_cents: agreedPrice }),
        start_date: bookingEditForm.start_date,
        end_date: bookingEditForm.end_date,
        target_url: bookingEditForm.target_url.trim() || null,
        banner_url: bookingEditForm.banner_url.trim() || null,
        logo_url: bookingEditForm.logo_url.trim() || null,
        custom_text: bookingEditForm.custom_text.trim() || null,
        notes: bookingEditForm.notes.trim() || null,
      })
      .eq('id', bookingId)
      .select(
        'id, partner_id, booking_type, package_code, package_name, duration_days, agreed_price_cents, list_price_cents, start_date, end_date, target_url, banner_url, logo_url, custom_text, status, notes, created_at, partners(name)'
      )
      .single()

    if (error || !data) {
      setPartnerMessage(`Fehler beim Speichern der Buchung: ${error?.message ?? 'Unbekannt'}`)
      return
    }

    const normalizedBooking = normalizeBooking(data as PartnerBookingRow)

    setPartnerBookings((prev) =>
      prev.map((booking) =>
        booking.id === bookingId ? normalizedBooking : booking
      )
    )

    cancelEditBooking()
    setPartnerMessage('Buchung wurde aktualisiert.')
  } catch (error) {
    setPartnerMessage(`Fehler: ${errorMessage(error)}`)
  } finally {
    setPartnerLoading(false)
  }
}

  async function handleUpdatePartnerBookingStatus(
  bookingId: string,
  nextStatus: PartnerBooking['status']
) {
  setPartnerLoading(true)
  setPartnerMessage('')

  try {
    const { error } = await supabase
      .from('partner_bookings')
      .update({ status: nextStatus })
      .eq('id', bookingId)

    if (error) {
      setPartnerMessage(`Fehler beim Aktualisieren: ${error.message}`)
      return
    }

    setPartnerBookings((prev) =>
      prev.map((booking) =>
        booking.id === bookingId
          ? { ...booking, status: nextStatus }
          : booking
      )
    )

    setPartnerMessage(`Buchung wurde auf "${nextStatus}" gesetzt.`)
  } catch (error) {
    setPartnerMessage(`Fehler: ${errorMessage(error)}`)
  } finally {
    setPartnerLoading(false)
  }
}

async function handleDeletePartnerBooking(bookingId: string) {
  const confirmed = window.confirm(
    'Diese Buchung wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.'
  )

  if (!confirmed) return

  setPartnerLoading(true)
  setPartnerMessage('')

  try {
    const { error } = await supabase
      .from('partner_bookings')
      .delete()
      .eq('id', bookingId)

    if (error) {
      setPartnerMessage(`Fehler beim Löschen: ${error.message}`)
      return
    }

    setPartnerBookings((prev) =>
      prev.filter((booking) => booking.id !== bookingId)
    )

    setPartnerMessage('Buchung wurde gelöscht.')
  } catch (error) {
    setPartnerMessage(`Fehler: ${errorMessage(error)}`)
  } finally {
    setPartnerLoading(false)
  }
}

  if (loading) {
    return (
      <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
        <div className="mx-auto max-w-6xl">
          <ProfileBrandBar />
          <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-xl shadow-black/10">
            <h1 className="text-2xl font-bold text-white">
              Admin-Bereich wird geladen…
            </h1>
            <p className="mt-3 text-stone-400">Einen Moment bitte.</p>
          </div>
        </div>
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
        <div className="mx-auto max-w-6xl">
          <ProfileBrandBar />
          <Link
            href="/admin"
            className="text-sm text-stone-400 transition hover:text-white"
          >
            ← Zurück zur Moderation
          </Link>

          <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-xl shadow-black/10">
            <h1 className="text-2xl font-bold text-white">Kein Zugriff</h1>
            <p className="mt-3 text-stone-400">
              Dieser Bereich ist nur für Admins verfügbar.
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
      <div className="mx-auto max-w-6xl">
        <ProfileBrandBar />

        <Link
          href="/admin"
          className="text-sm text-stone-400 transition hover:text-white"
        >
          ← Zurück zur Moderation
        </Link>

        <section className="mt-10 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/10">
          <div className="mb-6">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-stone-400">
              Admin-Bereich
            </div>
            <h1 className="mt-2 text-2xl font-bold text-white">
              Partner & Werbung
            </h1>
            <p className="mt-1 text-sm text-stone-400">
              Eventpartner und Brandpartner zentral anlegen und Buchungen verwalten.
            </p>
          </div>

          {partnerMessage ? (
            <div className="mb-5 rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-stone-200">
              {partnerMessage}
            </div>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-2">
            <div id="partner-form" className="rounded-[1.5rem] border border-white/10 bg-black/10 p-5">
              <h3 className="text-xl font-semibold text-white">
                {editingPartnerId ? 'Partner bearbeiten' : 'Partner anlegen'}
              </h3>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-200">
                    Partnername *
                  </label>
                  <input
                    type="text"
                    value={partnerForm.name}
                    onChange={(e) => updatePartnerForm('name', e.target.value)}
                    placeholder="z. B. GaPa Trail, Mammutmarsch, Marke XY"
                    className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-200">
                    Partnertyp
                  </label>
                  <select
                    value={partnerForm.partner_type}
                    onChange={(e) =>
                      updatePartnerForm(
                        'partner_type',
                        e.target.value as PartnerFormState['partner_type']
                      )
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                  >
                    <option value="event_partner">Eventpartner</option>
                    <option value="brand_partner">Brandpartner</option>
                    <option value="both">Beides</option>
                  </select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-stone-200">
                      Kontaktperson
                    </label>
                    <input
                      type="text"
                      value={partnerForm.contact_name}
                      onChange={(e) =>
                        updatePartnerForm('contact_name', e.target.value)
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-stone-200">
                      Kontakt-E-Mail
                    </label>
                    <input
                      type="email"
                      value={partnerForm.contact_email}
                      onChange={(e) =>
                        updatePartnerForm('contact_email', e.target.value)
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-200">
                    Website
                  </label>
                  <input
                    type="text"
                    value={partnerForm.website_url}
                    onChange={(e) =>
                      updatePartnerForm('website_url', e.target.value)
                    }
                    placeholder="https://..."
                    className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-200">
                    Logo-URL
                  </label>
                  <input
                    type="text"
                    value={partnerForm.logo_url}
                    onChange={(e) =>
                      updatePartnerForm('logo_url', e.target.value)
                    }
                    placeholder="https://..."
                    className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                  />
                  {partnerForm.logo_url ? (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/10 p-3">
                      <div className="mb-2 text-xs uppercase tracking-[0.18em] text-stone-500">
                        Logo-Vorschau
                      </div>
                      <img
                        src={partnerForm.logo_url}
                        alt="Partner Logo Vorschau"
                        className="h-12 max-w-[180px] object-contain"
                      />
                    </div>
                  ) : null}
                  <label
                    htmlFor="partner-logo-upload"
                    className="mt-3 inline-block cursor-pointer rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-stone-100 transition hover:bg-white/10"
                  >
                    {logoUploading ? 'Logo wird hochgeladen…' : 'Logo vom PC auswählen'}
                  </label>

                  <input
                    id="partner-logo-upload"
                    type="file"
                    accept="image/*"
                    disabled={logoUploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return

                      const publicUrl = await uploadPartnerAsset(file, 'logos')

                      if (publicUrl) {
                        updatePartnerForm('logo_url', publicUrl)
                        setPartnerMessage('Logo wurde hochgeladen.')
                      }

                      e.target.value = ''
                    }}
                    className="hidden"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-200">
                    Notizen
                  </label>
                  <textarea
                    value={partnerForm.notes}
                    onChange={(e) => updatePartnerForm('notes', e.target.value)}
                    rows={3}
                    className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSavePartner}
                  disabled={partnerLoading}
                  className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-stone-100 transition hover:-translate-y-0.5 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {partnerLoading ? 'Speichert…' : editingPartnerId ? 'Änderungen speichern' : 'Partner anlegen'}
                </button>
                {editingPartnerId && (
                  <button type="button" onClick={resetPartnerForm} disabled={partnerLoading || logoUploading}
                    className="ml-3 text-sm text-stone-300 hover:text-white">
                    Abbrechen
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-black/10 p-5">
              <h3 className="text-xl font-semibold text-white">
                Buchung anlegen
              </h3>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-200">
                    Partner *
                  </label>
                  <select
                    value={partnerBookingForm.partner_id}
                    onChange={(e) =>
                      updatePartnerBookingForm('partner_id', e.target.value)
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                  >
                    <option value="">Bitte auswählen</option>
                    {partners.map((partner) => (
                      <option key={partner.id} value={partner.id}>
                        {partner.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-stone-200">
                      Buchungstyp
                    </label>
                    <select
                      value={partnerBookingForm.booking_type}
                      onChange={(e) => {
                        const nextType = e.target
                          .value as PartnerBookingFormState['booking_type']

                        setPartnerBookingForm((prev) => ({
                          ...prev,
                          booking_type: nextType,
                          price: null,
                          package_code: 'A',
                          duration_days: '7',
                          end_date: prev.start_date ? packageEndDate(prev.start_date, '7') : prev.end_date,
                        }))
                      }}
                      className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                    >
                      <option value="event_partner">Eventpartner</option>
                      <option value="brand_partner">Brandpartner</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-stone-200">
                      Paket
                    </label>
                    <select
                      value={partnerBookingForm.package_code}
                      onChange={(e) => {
                        const nextPackageCode = e.target.value
                        const nextDuration = nextPackageCode === 'M' ? '' : String(
                          getDurationOptions(
                            partnerBookingForm.booking_type,
                            nextPackageCode
                          )[0]
                        )

                        setPartnerBookingForm((prev) => ({
                          ...prev,
                          package_code: nextPackageCode,
                          price: null,
                          duration_days: nextDuration,
                          end_date: prev.start_date
                            ? packageEndDate(prev.start_date, nextDuration)
                            : prev.end_date,
                        }))
                      }}
                      className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                    >
                      {getPartnerPackages(partnerBookingForm.booking_type).map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {!milestone && <div>
                  <label className="mb-2 block text-sm font-medium text-stone-200">
                    Laufzeit
                  </label>
                  <select
                    value={partnerBookingForm.duration_days}
                    onChange={(e) => {
                      const nextDuration = e.target.value

                      setPartnerBookingForm((prev) => ({
                        ...prev,
                        duration_days: nextDuration,
                        end_date: prev.start_date
                          ? packageEndDate(prev.start_date, nextDuration)
                          : prev.end_date,
                      }))
                    }}
                    className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                  >
                    {getPartnerPackages(partnerBookingForm.booking_type)
                      .find((item) => item.code === partnerBookingForm.package_code)
                      ?.offers.map(({ days, cents }) => (
                        <option key={days} value={String(days)}>
                          {formatDurationLabel(days)} · Paketpreis {euro.format(cents / 100)}
                        </option>
                      ))}
                  </select>
                </div>}
                <label className="block text-sm font-medium text-stone-200">
                  Vereinbarter Buchungspreis (EUR)
                  <input inputMode="decimal" readOnly={milestone}
                    value={partnerBookingForm.price ?? bookingPriceInput(suggestedPrice)}
                    onChange={event => updatePartnerBookingForm('price', event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white" />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-stone-200">
                      Startdatum *
                    </label>
                    <input
                      type="date"
                      value={partnerBookingForm.start_date}
                      onChange={(e) => {
                        const nextStartDate = e.target.value

                        setPartnerBookingForm((prev) => ({
                          ...prev,
                          start_date: nextStartDate,
                          end_date: milestone ? prev.end_date : packageEndDate(nextStartDate, prev.duration_days),
                        }))
                      }}
                      className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-stone-200">
                      Enddatum *
                    </label>
                    <input
                      type="date"
                      value={partnerBookingForm.end_date}
                      onChange={(e) =>
                        updatePartnerBookingForm('end_date', e.target.value)
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-200">
                    Ziel-Link
                  </label>
                  <input
                    type="text"
                    value={partnerBookingForm.target_url}
                    onChange={(e) =>
                      updatePartnerBookingForm('target_url', e.target.value)
                    }
                    placeholder="https://..."
                    className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {!milestone && <div>
                    <label className="mb-2 block text-sm font-medium text-stone-200">
                      Banner-URL
                    </label>
                    <input
                      type="text"
                      value={partnerBookingForm.banner_url}
                      onChange={(e) =>
                        updatePartnerBookingForm('banner_url', e.target.value)
                      }
                      placeholder="https://..."
                      className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                    />
                    {partnerBookingForm.banner_url ? (
                      <div className="mt-3 rounded-2xl border border-white/10 bg-black/10 p-3">
                        <div className="mb-2 text-xs uppercase tracking-[0.18em] text-stone-500">
                          Banner-Vorschau
                        </div>
                        <img
                          src={partnerBookingForm.banner_url}
                          alt="Banner Vorschau"
                          className="w-full rounded-xl object-contain"
                        />
                      </div>
                    ) : null}

                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/avif,image/gif,image/svg+xml"
                      onChange={(e) =>
                        handleUploadPartnerBookingAsset(e.target.files?.[0], 'banner_url')
                      }
                      disabled={logoUploading}
                      className="mt-2 block w-full text-xs text-stone-400 file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white hover:file:bg-white/15"
                    />
                  </div>}

                  <div>
                    <label className="mb-2 block text-sm font-medium text-stone-200">
                      Logo-URL
                    </label>
                    <input
                      type="text"
                      value={partnerBookingForm.logo_url}
                      onChange={(e) =>
                        updatePartnerBookingForm('logo_url', e.target.value)
                      }
                      placeholder="https://..."
                      className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                    />
                    {partnerBookingForm.logo_url ? (
                      <div className="mt-3 rounded-2xl border border-white/10 bg-black/10 p-3">
                        <div className="mb-2 text-xs uppercase tracking-[0.18em] text-stone-500">
                          Logo-Vorschau
                        </div>
                        <img
                          src={partnerBookingForm.logo_url}
                          alt="Buchungslogo Vorschau"
                          className="h-12 max-w-[180px] object-contain"
                        />
                      </div>
                    ) : null}

                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/avif,image/gif,image/svg+xml"
                      onChange={(e) =>
                        handleUploadPartnerBookingAsset(e.target.files?.[0], 'logo_url')
                      }
                      disabled={logoUploading}
                      className="mt-2 block w-full text-xs text-stone-400 file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white hover:file:bg-white/15"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-200">
                    Wunschtext / Beschreibung
                  </label>
                  <textarea
                    value={partnerBookingForm.custom_text}
                    onChange={(e) =>
                      updatePartnerBookingForm('custom_text', e.target.value)
                    }
                    rows={3}
                    className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-200">
                    Buchungsnotiz
                  </label>
                  <textarea
                    value={partnerBookingForm.notes}
                    onChange={(e) =>
                      updatePartnerBookingForm('notes', e.target.value)
                    }
                    rows={3}
                    className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleCreatePartnerBooking}
                  disabled={partnerLoading || logoUploading}
                  className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-stone-100 transition hover:-translate-y-0.5 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {partnerLoading ? 'Speichert…' : 'Buchung anlegen'}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-2">
            <div>
              <h3 className="mb-3 text-lg font-semibold text-white">
                Angelegte Partner
              </h3>

              <div className="space-y-3">
                {partners.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-stone-400">
                    Noch keine Partner angelegt.
                  </div>
                ) : (
                  partners.map((partner) => (
                    <div
                      key={partner.id}
                      className="rounded-2xl border border-white/10 bg-black/10 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-white">
                            {partner.name}
                          </div>
                          <div className="mt-1 text-xs text-stone-500">
                            {partner.partner_type}
                          </div>
                        </div>

                        {partner.logo_url ? (
                          <a
                            href={partner.logo_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-stone-400 underline underline-offset-4 transition hover:text-white"
                          >
                            Logo öffnen
                          </a>
                        ) : (
                          <span className="text-xs text-stone-600">Kein Logo</span>
                        )}
                      </div>

                      <button type="button" disabled={partnerLoading || logoUploading} onClick={() => startEditPartner(partner)}
                        className="mt-3 text-sm text-stone-300 underline underline-offset-4 hover:text-white">
                        Partner bearbeiten
                      </button>

                      {partner.contact_email ? (
                        <div className="mt-2 text-sm text-stone-400">
                          {partner.contact_email}
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-lg font-semibold text-white">
                Buchungen
              </h3>

              <div className="space-y-3">
                {partnerBookings.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-stone-400">
                    Noch keine Buchungen angelegt.
                  </div>
                ) : (
                  partnerBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="rounded-2xl border border-white/10 bg-black/10 p-4"
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="font-semibold text-white">
                              {booking.partners?.name ?? 'Unbekannter Partner'}
                            </div>

                            <div className="mt-1 text-sm text-stone-300">
                              {booking.package_code === 'M' ? booking.package_name :
                                (booking.booking_type === 'brand_partner' ? 'Brandpartner' : 'Eventpartner') +
                                ' · Paket ' + booking.package_code + ' · ' + booking.package_name}
                            </div>

                            <div className="mt-1 text-xs text-stone-500">
                              {booking.start_date} bis {booking.end_date} · Buchungspreis {booking.agreed_price_cents === null
                                ? 'historisch nicht erfasst' : euro.format(booking.agreed_price_cents / 100)}
                              {booking.list_price_cents !== null && ' · Listenpreis ' + euro.format(booking.list_price_cents / 100)}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 md:justify-end">
                            <div
                              className={`inline-flex h-fit w-fit rounded-full px-3 py-1 text-xs ${
                                booking.status === 'active'
                                  ? 'border border-emerald-400/30 bg-emerald-400/12 text-emerald-200'
                                  : 'border border-stone-300/20 bg-stone-300/5 text-stone-300'
                              }`}
                            >
                              {{ draft: 'Werbestatus unter Unterlagen', active: 'Altbuchung', paused: 'Pausiert', expired: 'Beendet' }[booking.status]}
                            </div>

                            <button
                              type="button"
                              onClick={() => startEditBooking(booking)}
                              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-stone-100 transition hover:bg-white/10"
                            >
                              Bearbeiten
                            </button>

                            <button
                              type="button"
                              aria-expanded={documentBookingId === booking.id}
                              onClick={() => setDocumentBookingId(documentBookingId === booking.id ? null : booking.id)}
                              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-stone-100"
                            >
                              Unterlagen
                            </button>

                            {booking.status === 'active' ? (
                              <button
                                type="button"
                                onClick={() => handleUpdatePartnerBookingStatus(booking.id, 'paused')}
                                disabled={partnerLoading}
                                className="rounded-xl border border-yellow-400/30 bg-yellow-400/12 px-3 py-2 text-xs font-medium text-yellow-200"
                              >
                                Pausieren
                              </button>
                            ) : null}

                            {booking.status !== 'expired' ? (
                              <button
                                type="button"
                                onClick={() => handleUpdatePartnerBookingStatus(booking.id, 'expired')}
                                disabled={partnerLoading}
                                className="rounded-xl border border-stone-300/20 bg-stone-300/5 px-3 py-2 text-xs font-medium text-stone-300"
                              >
                                Beenden
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => handleDeletePartnerBooking(booking.id)}
                              disabled={partnerLoading}
                              className="rounded-xl border border-red-400/30 bg-red-400/12 px-3 py-2 text-xs font-medium text-red-200"
                            >
                              Löschen
                            </button>
                          </div>
                        </div>

                        {documentBookingId === booking.id && (
                          <PartnerDocuments key={booking.id} bookingId={booking.id} status={booking.status}
                            bookingType={booking.booking_type} packageCode={booking.package_code}
                            agreedPrice={booking.agreed_price_cents} start={booking.start_date} end={booking.end_date} />
                        )}

                        {editingBookingId === booking.id ? (
                          <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                            <div className="mb-4 text-sm font-semibold text-white">
                              Buchung bearbeiten
                            </div>

                            <label className="mb-4 block text-sm text-stone-200">
                              Vereinbarter Buchungspreis (EUR)
                              <input inputMode="decimal" readOnly={booking.package_code === 'M'} value={bookingEditForm.price}
                                onChange={event => updateBookingEditForm('price', event.target.value)}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white" />
                            </label>
                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <label className="mb-2 block text-xs font-medium text-stone-300">
                                  Startdatum
                                </label>
                                <input
                                  type="date"
                                  value={bookingEditForm.start_date}
                                  onChange={(e) =>
                                    updateBookingEditForm('start_date', e.target.value)
                                  }
                                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                                />
                              </div>

                              <div>
                                <label className="mb-2 block text-xs font-medium text-stone-300">
                                  Enddatum
                                </label>
                                <input
                                  type="date"
                                  value={bookingEditForm.end_date}
                                  onChange={(e) =>
                                    updateBookingEditForm('end_date', e.target.value)
                                  }
                                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                                />
                              </div>
                            </div>

                            <div className="mt-4">
                              <label className="mb-2 block text-xs font-medium text-stone-300">
                                Ziel-URL
                              </label>
                              <input
                                type="text"
                                value={bookingEditForm.target_url}
                                onChange={(e) =>
                                  updateBookingEditForm('target_url', e.target.value)
                                }
                                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                              />
                            </div>

                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                              <div>
                                <label className="mb-2 block text-xs font-medium text-stone-300">
                                  Banner-URL
                                </label>
                                <input
                                  type="text"
                                  value={bookingEditForm.banner_url}
                                  onChange={(e) =>
                                    updateBookingEditForm('banner_url', e.target.value)
                                  }
                                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                                />
                              </div>

                              <div>
                                <label className="mb-2 block text-xs font-medium text-stone-300">
                                  Logo-URL
                                </label>
                                <input
                                  type="text"
                                  value={bookingEditForm.logo_url}
                                  onChange={(e) =>
                                    updateBookingEditForm('logo_url', e.target.value)
                                  }
                                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                                />
                              </div>
                            </div>

                            <div className="mt-4">
                              <label className="mb-2 block text-xs font-medium text-stone-300">
                                Wunschtext / Beschreibung
                              </label>
                              <textarea
                                value={bookingEditForm.custom_text}
                                onChange={(e) =>
                                  updateBookingEditForm('custom_text', e.target.value)
                                }
                                rows={2}
                                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                              />
                            </div>

                            <div className="mt-4">
                              <label className="mb-2 block text-xs font-medium text-stone-300">
                                Notizen
                              </label>
                              <textarea
                                value={bookingEditForm.notes}
                                onChange={(e) =>
                                  updateBookingEditForm('notes', e.target.value)
                                }
                                rows={2}
                                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                              />
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleUpdatePartnerBooking(booking.id)}
                                disabled={partnerLoading}
                                className="rounded-xl border border-emerald-400/30 bg-emerald-400/12 px-4 py-2 text-xs font-medium text-emerald-200 transition hover:bg-emerald-400/18 disabled:opacity-50"
                              >
                                Speichern
                              </button>

                              <button
                                type="button"
                                onClick={cancelEditBooking}
                                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-stone-100 transition hover:bg-white/10"
                              >
                                Abbrechen
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

      </div>
    </main>
  )
}
