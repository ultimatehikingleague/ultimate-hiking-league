import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export const berlinDate = (date: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(date)

export function addCalendarDays(date: string, days: number) {
  const utc = new Date(date + 'T00:00:00Z')
  utc.setUTCDate(utc.getUTCDate() + days)
  return utc.toISOString().slice(0, 10)
}

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T00:00:00Z')
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value
}

export const seller = {
  name: 'Philipp Dobrinski / ULTIMATE',
  address: 'Ansbacher Straße 4a\n91452 Wilhermsdorf\nDeutschland',
  email: 'ultimatehikingleague@gmail.com',
}
export const taxNotice = 'Für diese Leistung gilt die Steuerbefreiung für Kleinunternehmer gemäß § 19 UStG.'

export type PartnerTerms = {
  partner: string
  recipient: string
  address: string
  packageName: string
  services: string
  start: string
  end: string
  amountCents: number
  listPriceCents?: number | null
  validUntil: string
}
type Seller = typeof seller & { taxNumber?: string }

export async function renderPartnerDocument(
  title: string, reference: string, date: string, terms: PartnerTerms,
  details: string[], issuer: Seller = seller,
) {
  const doc = await PDFDocument.create()
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(.12, .16, .13)
  let page = doc.addPage([595.28, 841.89])
  let y = 790

  function line(value: string, size = 11, strong = false) {
    const font = strong ? bold : regular
    const safe = Array.from(value).map(char => {
      try { font.encodeText(char); return char } catch { return '?' }
    }).join('')
    let segment = ''
    const draw = (text: string) => {
      if (y < 56) { page = doc.addPage([595.28, 841.89]); y = 790 }
      if (text) page.drawText(text, { x: 48, y, font, size, color: ink })
      y -= size + 6
    }
    for (const word of safe.split(/\s+/)) {
      const next = segment ? segment + ' ' + word : word
      if (font.widthOfTextAtSize(next, size) <= 494) { segment = next; continue }
      if (segment) draw(segment)
      segment = ''
      for (const char of word) {
        if (font.widthOfTextAtSize(segment + char, size) > 494) { draw(segment); segment = '' }
        segment += char
      }
    }
    draw(segment)
  }

  line('ULTIMATE HIKING LEAGUE', 13, true)
  y -= 16
  line(title, 24, true)
  line(reference + '  |  ' + date)
  y -= 16
  line('Ausgestellt von', 11, true)
  for (const item of [issuer.name, ...issuer.address.split('\n'), issuer.email]) line(item)
  if (issuer.taxNumber) line('Steuernummer: ' + issuer.taxNumber)
  y -= 12
  line('Empfänger', 11, true)
  for (const item of [terms.recipient, ...terms.address.split('\n')]) line(item)
  y -= 14
  line(terms.packageName, 13, true)
  line('Vereinbarter Zeitraum: ' + terms.start + ' bis ' + terms.end)
  for (const item of terms.services.split('\n')) line(item)
  y -= 12
  const amount = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(terms.amountCents / 100)
  line('Gesamtbetrag: ' + amount, 13, true)
  line(taxNotice)
  y -= 12
  for (const item of details) line(item)
  return Buffer.from(await doc.save()).toString('base64')
}
