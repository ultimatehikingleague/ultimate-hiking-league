import { PDFDocument } from 'pdf-lib'
import { shopAdminId } from '../../../../lib/requireShopAdmin'
import { orderDB } from '../../../../lib/shop/orders'
import { getPartnerPackages, packageEndDate } from '../../../../lib/partners/packages'
import { addCalendarDays, berlinDate, isCalendarDate, renderPartnerDocument, seller, type PartnerTerms } from '../../../../lib/partners/documents'

export const runtime = 'nodejs'
const noCache = { 'Cache-Control': 'private, no-store' }
const dossierState = 'terms,offered_at,accepted_on,payment_requested_at,payment_due_on,paid_on,paid_cents,invoice_number,invoice_archived'
type Dossier = {
  terms: PartnerTerms
  offered_at: string
  accepted_on: string | null
  payment_requested_at: string | null
  paid_on: string | null
  invoice_number: string | null
  invoice_archived: boolean
}
const cooperationState = 'kind,explanation,term_kind,agreed_start,fixed_end,partnership_end,minimum_end,effective_end,fulfilled_on'
const files = { offer: 'offer_pdf', contract: 'contract_pdf', payment: 'payment_request_pdf', invoice: 'invoice_pdf' } as const
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: noCache })
const rejected = (message: string, status = 400) => json({ error: message }, status)

export async function GET(request: Request) {
  if (!await shopAdminId(request)) return rejected('Zugriff verweigert.', 403)
  const url = new URL(request.url)
  const id = url.searchParams.get('id') ?? ''
  const kind = url.searchParams.get('file')
  if (!uuid.test(id)) return rejected('Ungültige Buchung.')
  const db = orderDB()
  if (!kind) {
    const [dossier, cooperation, approval, social] = await Promise.all([
      db.from('partner_dossiers').select(dossierState).eq('booking_id', id).maybeSingle(),
      db.from('partner_cooperations').select(cooperationState).eq('booking_id', id).maybeSingle(),
      db.from('partner_placement_approvals').select('start_on,end_on,event_ids,approved_at,revoked_at,revoke_reason').eq('booking_id', id).maybeSingle(),
      db.from('partner_social_mentions').select('published_on,post_url').eq('booking_id', id).maybeSingle(),
    ])
    if (dossier.error || cooperation.error || approval.error || social.error) return rejected('Unterlagen konnten nicht geladen werden.', 500)
    return json({ dossier: dossier.data, cooperation: cooperation.data, approval: approval.data, social: social.data })
  }
  if (!Object.prototype.hasOwnProperty.call(files, kind)) return rejected('Unbekanntes Dokument.')
  const column = files[kind as keyof typeof files]
  const { data, error } = await db.from('partner_dossiers').select(column).eq('booking_id', id).maybeSingle<Partial<Record<typeof column, string | null>>>()
  if (error) return rejected('Dokument konnte nicht geladen werden.', 500)
  const pdf = data?.[column]
  if (!pdf) return rejected('Dokument fehlt.', 404)
  return new Response(Uint8Array.from(Buffer.from(pdf, 'base64')), {
    headers: { ...noCache, 'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="' + kind + '-' + id + '.pdf"' },
  })
}

export async function POST(request: Request) {
  const admin = await shopAdminId(request)
  if (!admin) return rejected('Zugriff verweigert.', 403)
  try {
    const body = await request.json()
    if (!body || typeof body.id !== 'string' || !uuid.test(body.id)) return rejected('Ungültige Buchung.')
    const id = body.id
    const db = orderDB()
    const now = new Date()
    const today = berlinDate(now)
    const offerRef = 'ANG-' + id
    const paymentRef = 'ZA-' + id
    const clean = (value: unknown, max: number) => typeof value === 'string' && value.trim().length <= max ? value.trim() : ''

    if (body.action === 'approve-placement') {
      if (!Array.isArray(body.eventIds) || body.eventIds.length > 15 ||
        !body.eventIds.every((value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0)) {
        return rejected('Bitte gültige Events wählen.')
      }
      const result = await db.rpc('uhl_approve_partner_placement', {
        p_booking_id: id, p_admin: admin, p_event_ids: body.eventIds,
      })
      if (result.error?.code === 'P0001') return rejected(result.error.message, 409)
      if (result.error) throw result.error
      return json({ ok: true })
    }
    if (body.action === 'revoke-placement') {
      const reason = clean(body.reason, 500)
      if (!reason) return rejected('Bitte einen Grund für die Abschaltung angeben.')
      const result = await db.rpc('uhl_revoke_partner_placement', {
        p_booking_id: id, p_admin: admin, p_reason: reason,
      })
      if (result.error?.code === 'P0001') return rejected(result.error.message, 409)
      if (result.error) throw result.error
      return json({ ok: true })
    }
    if (body.action === 'record-social') {
      const url = clean(body.url, 750)
      if (!/^https:\/\/[^\s]+$/.test(url) || !isCalendarDate(body.date) || body.date > today)
        return rejected('HTTPS-Link zum Beitrag und Veröffentlichungsdatum prüfen.')
      const { data: booking, error } = await db.from('partner_bookings').select('booking_type,package_code').eq('id', id).single()
      if (error || booking.booking_type !== 'brand_partner' || booking.package_code !== 'F')
        return rejected('Social-Erwähnungen gehören zu Brand F.')
      const result = await db.from('partner_social_mentions').insert({
        booking_id: id, published_on: body.date, post_url: url, recorded_by: admin,
      })
      if (result.error?.code === '23505') return rejected('Die Social-Erwähnung wurde bereits archiviert.', 409)
      if (result.error) throw result.error
      return json({ ok: true })
    }

    if (body.action === 'record-cooperation') {
      const { data: booking, error } = await db.from('partner_bookings').select('start_date,status,agreed_price_cents,package_code').eq('id', id).single()
      if (error || booking.status !== 'draft') return rejected('Ein Buchungsentwurf ist erforderlich.', 409)
      if (booking.package_code === 'M' || (booking.agreed_price_cents ?? 0) !== 0)
        return rejected('Eine Kooperation erfordert einen Buchungspreis von 0,00 EUR. Die Milestone-Präsenz kann direkt freigegeben werden.')
      const explanation = clean(body.explanation, 2000)
      if (!explanation || !['in_kind', 'goodwill', 'unpaid_milestone'].includes(body.kind)
        || !['fixed', 'partnership', 'minimum'].includes(body.termKind)) return rejected('Art, Begründung und Laufzeit wählen.')
      const fixed = body.termKind === 'fixed' ? body.fixedEnd : null
      const partnership = body.termKind !== 'fixed' ? body.partnershipEnd || null : null
      const minimum = body.termKind === 'minimum' ? body.minimumEnd : null
      if (!isCalendarDate(booking.start_date) || fixed === '' || minimum === '' ||
        [fixed, partnership, minimum].some(date => date !== null && (!isCalendarDate(date) || date < booking.start_date))) {
        return rejected('Enddaten müssen am oder nach dem Buchungsstart liegen.')
      }
      const saved = await db.from('partner_cooperations').insert({
        booking_id: id, kind: body.kind, explanation, term_kind: body.termKind,
        agreed_start: booking.start_date, fixed_end: fixed, partnership_end: partnership,
        minimum_end: minimum, recorded_by: admin,
      })
      if (saved.error?.code === '23505') return rejected('Diese Buchung hat bereits eine Kooperation oder ein Angebot.', 409)
      if (saved.error?.code === '23514') return rejected(saved.error.message, 409)
      if (saved.error) throw saved.error
      return json({ ok: true }, 201)
    }
    if (body.action === 'close-partnership') {
      if (!isCalendarDate(body.date)) return rejected('Bitte das Partnerschaftsende angeben.')
      const saved = await db.from('partner_cooperations').update({
        partnership_end: body.date, closed_by: admin, closed_at: now.toISOString(),
      }).eq('booking_id', id).neq('term_kind', 'fixed').lte('agreed_start', body.date)
        .is('partnership_end', null).select('booking_id')
      if (saved.error) throw saved.error
      if (!saved.data.length) return rejected('Kein offenes oder gültiges Partnerschaftsende.', 409)
      return json({ ok: true })
    }
    if (body.action === 'fulfill-cooperation') {
      const note = clean(body.note, 500)
      if (!note || !isCalendarDate(body.date) || body.date > today) return rejected('Erfüllungsdatum und Nachweis prüfen.')
      const saved = await db.from('partner_cooperations').update({
        fulfilled_on: body.date, fulfillment_note: note, fulfilled_by: admin,
      }).eq('booking_id', id).eq('kind', 'in_kind').is('fulfilled_on', null).select('booking_id')
      if (saved.error) throw saved.error
      if (!saved.data.length) return rejected('Keine offene Sachleistung vorhanden.', 409)
      return json({ ok: true })
    }

    if (body.action === 'offer') {
      const { data: booking, error } = await db.from('partner_bookings')
        .select('booking_type,package_code,duration_days,agreed_price_cents,list_price_cents,start_date,end_date,status,partners(name)').eq('id', id).single()
      if (error || booking.status !== 'draft') return rejected('Ein Buchungsentwurf ist erforderlich.', 409)
      if (booking.booking_type !== 'brand_partner' && booking.booking_type !== 'event_partner') return rejected('Ungültiger Buchungstyp.')
      const pack = getPartnerPackages(booking.booking_type).find(item => item.code === booking.package_code)
      const price = pack?.offers.find(item => item.days === booking.duration_days)
      const partner = Array.isArray(booking.partners) ? booking.partners[0] : booking.partners
      const recipient = clean(body.recipient, 180), address = clean(body.address, 450)
      const additionalDetails = clean(body.services, 1700)
      if (body.services && !additionalDetails) return rejected('Zusätzliche Angebotsdetails sind zu lang oder ungültig.')
      if (!pack || !price || !partner || !recipient || !address || !isCalendarDate(body.date)
        || body.date < today || !isCalendarDate(booking.start_date) || !isCalendarDate(booking.end_date)
        || booking.end_date !== packageEndDate(booking.start_date, String(price.days))) {
        return rejected('Empfänger, Anschrift, Paketlaufzeit und Angebotsgültigkeit prüfen.')
      }
      const agreedPrice = booking.agreed_price_cents ?? price.cents
      if (agreedPrice === 0) return rejected('Kostenlose Buchungen bitte als Kooperation oder Kulanz erfassen.')
      const terms: PartnerTerms = { partner: partner.name, recipient, address,
        services: [pack.services, additionalDetails].filter(Boolean).join('\n'), validUntil: body.date,
        packageName: (booking.booking_type === 'brand_partner' ? 'Brand ' : 'Event ') + pack.label,
        amountCents: agreedPrice, listPriceCents: booking.list_price_cents, start: booking.start_date, end: booking.end_date }
      const pdf = await renderPartnerDocument('Angebot', offerRef, today, terms, ['Gültig bis ' + body.date])
      const saved = await db.from('partner_dossiers').insert({ booking_id: id, terms, offer_pdf: pdf, offered_by: admin })
      if (saved.error?.code === '23505') return rejected('Diese Buchung hat bereits ein Angebot oder eine Kooperation.', 409)
      if (saved.error?.code === '23514') return rejected(saved.error.message, 409)
      if (saved.error) throw saved.error
      return json({ ok: true }, 201)
    }

    const result = await db.from('partner_dossiers')
      .select(dossierState).eq('booking_id', id).maybeSingle<Dossier>()
    if (result.error) throw result.error
    const dossier = result.data
    if (!dossier) return rejected('Zuerst ein Angebot erstellen.', 409)
    const terms = dossier.terms

    let updates
    let guard
    switch (body.action) {
      case 'accept': {
        if (dossier.accepted_on) return rejected('Annahme ist bereits archiviert.', 409)
        if (!isCalendarDate(body.date) || body.date > today || body.date > terms.validUntil
          || body.date < berlinDate(new Date(dossier.offered_at))) return rejected('Annahmedatum muss innerhalb der Angebotsgültigkeit liegen.')
        if (typeof body.contract !== 'string' || body.contract.length > 4_000_000) return rejected('Eine Vertrags-PDF bis 3 MB ist erforderlich.')
        const bytes = Buffer.from(body.contract, 'base64')
        try {
          if (bytes.subarray(0, 5).toString() !== '%PDF-' || !(await PDFDocument.load(bytes)).getPageCount()) throw new Error('Invalid PDF')
        } catch { return rejected('Die Vertrags-PDF konnte nicht gelesen werden.') }
        updates = { accepted_on: body.date, contract_pdf: bytes.toString('base64'), accepted_by: admin }
        guard = 'accepted_on'
        break
      }
      case 'request-payment': {
        if (!dossier.accepted_on || dossier.payment_requested_at) return rejected('Eine angenommene Buchung ohne Zahlungsanforderung ist erforderlich.', 409)
        if (![0, 7, 14].includes(body.days)) return rejected('Bitte sofort, 7 oder 14 Tage wählen.')
        const due = addCalendarDays(today, body.days)
        const pdf = await renderPartnerDocument('Zahlungsanforderung', paymentRef, today, terms, [
          'Zahlbar bis ' + due + (body.days === 0 ? ' (sofort)' : ''),
          'Kontoinhaber: Philipp Dobrinski', 'IBAN: DE88760400610616020400', 'Verwendungszweck: ' + paymentRef,
        ])
        updates = { payment_requested_at: now.toISOString(), payment_requested_by: admin,
          payment_due_on: due, payment_request_pdf: pdf }
        guard = 'payment_requested_at'
        break
      }
      case 'confirm-payment': {
        if (!dossier.payment_requested_at || dossier.paid_on) return rejected('Eine offene Zahlungsanforderung ist erforderlich.', 409)
        if (!isCalendarDate(body.date) || body.date < berlinDate(new Date(dossier.payment_requested_at)) || body.date > today ||
          body.cents !== terms.amountCents) return rejected('Datum prüfen und den vollständigen Zahlungseingang bestätigen.')
        const note = clean(body.note, 500)
        if (!note) return rejected('Bitte einen Zahlungsvermerk angeben.')
        updates = { paid_on: body.date, paid_cents: body.cents, payment_note: note,
          payment_confirmed_by: admin, payment_confirmed_at: now.toISOString() }
        guard = 'paid_on'
        break
      }
      case 'invoice': {
        if (!dossier.paid_on) return rejected('Zuerst Zahlungseingang bestätigen.', 409)
        if (dossier.invoice_archived) return json({ ok: true })
        const taxNumber = process.env.SHOP_SELLER_TAX_NUMBER?.trim() ?? ''
        if (!dossier.invoice_number && !taxNumber) return rejected('Steuernummer für die Rechnung fehlt.', 409)
        const issued = await db.rpc('uhl_issue_partner_invoice', { p_booking_id: id, p_admin: admin, p_seller: { ...seller, taxNumber } })
        if (issued.error) throw issued.error
        const snapshot = await db.from('partner_dossiers').select('invoice_number,invoice_issued_at,invoice_seller,invoice_pdf').eq('booking_id', id).single()
        if (snapshot.error) throw snapshot.error
        if (snapshot.data.invoice_pdf) return json({ ok: true })
        const invoice = snapshot.data
        const pdf = await renderPartnerDocument('Rechnung', invoice.invoice_number,
          berlinDate(new Date(invoice.invoice_issued_at)), terms, ['Bezahlt am ' + dossier.paid_on + '. Kein weiterer Betrag offen.'], invoice.invoice_seller)
        updates = { invoice_pdf: pdf }
        guard = 'invoice_pdf'
        break
      }
      default: return rejected('Unbekannte Aktion.')
    }

    const saved = await db.from('partner_dossiers').update(updates).eq('booking_id', id).is(guard, null).select('booking_id')
    if (saved.error) throw saved.error
    if (!saved.data.length && body.action !== 'invoice') return rejected('Der Vorgang wurde bereits gespeichert. Bitte neu laden.', 409)
    return json({ ok: true })
  } catch (error) {
    console.error('Partner document operation failed', error instanceof Error ? error.message : 'database operation')
    return rejected('Der Belegvorgang konnte nicht abgeschlossen werden.', 500)
  }
}
