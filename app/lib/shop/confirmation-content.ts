import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { Invoice } from './invoices'
import { PURCHASE_TEXT, WITHDRAWAL_TEXT } from './legal'

const currency = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
const money = (cents: number) => currency.format(cents / 100)
const countries: Record<string, string> = { DE: 'Deutschland', AT: 'Österreich', CH: 'Schweiz' }

export function confirmationText(invoice: Invoice) {
  const { buyer, lines, shippingCents, discountCents, totalCents } = invoice.snapshot
  const address = [
    buyer.firstName + ' ' + buyer.lastName, buyer.addressLine1, buyer.addressLine2,
    buyer.postCode + ' ' + buyer.city, countries[buyer.country] ?? buyer.country,
  ].filter(Boolean).join('\n')
  const items = lines.map(line => `${line.quantity} × ${line.name} · ${money(line.total_cents)}`).join('\n')

  return `Hallo ${buyer.firstName},

vielen Dank für deine Bestellung beim ULTIMATE Outdoor Store! ${totalCents === 0 ? 'Wir haben deine Bestellung angenommen. Es ist keine Zahlung erforderlich.' : 'Deine Zahlung ist bestätigt und wir haben deine Bestellung angenommen.'}

Bestellnummer: ${invoice.order_id}

${items}
${discountCents ? `Gutscheinrabatt: ${money(-discountCents)}\n` : ''}Versand: ${money(shippingCents)}
Gesamtbetrag: ${money(totalCents)}

Lieferadresse
${address}

Deine Rechnung und die Verbraucherinformationen mit Widerrufsbelehrung und Muster-Widerrufsformular findest du im Anhang. Bei Fragen kannst du direkt auf diese E-Mail antworten.

Viele Grüße
Dein ULTIMATE Outdoor Store`
}

export async function renderConsumerInformation(invoice: Invoice): Promise<Buffer> {
  const { terms } = invoice.snapshot
  const doc = await PDFDocument.create()
  doc.setTitle('Verbraucherinformationen – ULTIMATE Outdoor Store')
  doc.setAuthor(invoice.snapshot.seller.name)
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.12, 0.16, 0.13)
  const size = 11
  const margin = 48
  const width = 595.28 - margin * 2
  const headingLines = new Set(['Widerrufsbelehrung für Waren', 'Folgen des Widerrufs', 'Muster-Widerrufsformular'])

  function newPage() {
    const page = doc.addPage([595.28, 841.89])
    page.drawText('ULTIMATE OUTDOOR STORE', { x: margin, y: 792, size: 12, font: bold, color: ink })
    page.drawText(`Seite ${doc.getPageCount()}`, { x: margin, y: 34, size: 9, font: regular, color: ink })
    return page
  }

  let page = newPage()
  page.drawText('Verbraucherinformationen', { x: margin, y: 760, size: 19, font: bold, color: ink })
  let y = 727
  function draw(line: string, heading: boolean) {
    const font = heading ? bold : regular
    let wrapped = ''
    for (const word of line.split(/\s+/)) {
      const next = wrapped ? wrapped + ' ' + word : word
      if (wrapped && font.widthOfTextAtSize(next, size) > width) {
        drawLine(wrapped)
        wrapped = word
      } else {
        wrapped = next
      }
    }
    drawLine(wrapped)

    function drawLine(text: string) {
      if (y < 66 || (heading && y < 90)) { page = newPage(); y = 752 }
      page.drawText(text, { x: margin, y, size, font, color: ink })
      y -= 15
    }
  }

  const content = (terms?.purchase || PURCHASE_TEXT) + '\n\n' + (terms?.withdrawal || WITHDRAWAL_TEXT)
  for (const line of content.split(/\r?\n/)) {
    if (line.trim()) draw(line, headingLines.has(line))
    else y -= 9
  }
  return Buffer.from(await doc.save())
}
