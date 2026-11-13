import { createHash } from 'node:crypto'
import { requireShopAdmin } from '../../../../lib/requireShopAdmin'
import { invoiceNumber } from '../../../../lib/shop/invoice-backup'
import { orderDB } from '../../../../lib/shop/orders'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = {
  'Cache-Control': 'private, no-store',
  'Vary': 'Authorization',
  'X-Content-Type-Options': 'nosniff',
}
const pageSize = 100

export async function GET(request: Request) {
  try {
    if (!await requireShopAdmin(request)) {
      return Response.json({ error: 'Zugriff verweigert.' }, { status: 403, headers })
    }

    const params = new URL(request.url).searchParams
    const number = params.get('number')
    const after = params.get('after')
    if ((number !== null && !invoiceNumber.test(number)) ||
        (after !== null && !invoiceNumber.test(after)) ||
        (number !== null && after !== null)) {
      return Response.json({ error: 'Ungültige Rechnungskennung.' }, { status: 400, headers })
    }

    const db = orderDB()
    if (number !== null) {
      const { data, error } = await db.from('shop_invoices').select('pdf_base64')
        .eq('mode', 'live').eq('number', number).maybeSingle()
      if (error) throw error
      if (!data?.pdf_base64) {
        return Response.json({ error: 'Gespeicherte Rechnung fehlt.' }, { status: 404, headers })
      }
      const pdf = Buffer.from(data.pdf_base64, 'base64')
      if (pdf.subarray(0, 5).toString() !== '%PDF-') throw Error('Invalid stored PDF')
      return new Response(new Uint8Array(pdf), {
        headers: {
          ...headers,
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${number}.pdf"`,
          'X-Invoice-SHA256': createHash('sha256').update(pdf).digest('hex'),
        },
      })
    }

    let query = db.from('shop_invoices').select('number').eq('mode', 'live')
      .order('number').limit(pageSize + 1)
    if (after !== null) query = query.gt('number', after)
    const { data, error } = await query
    if (error) throw error
    const numbers = data.slice(0, pageSize).map(row => row.number)
    return Response.json({
      numbers,
      next: data.length > pageSize ? numbers.at(-1) : null,
    }, { headers })
  } catch {
    return Response.json({ error: 'Rechnungen konnten nicht gelesen werden.' }, { status: 503, headers })
  }
}
