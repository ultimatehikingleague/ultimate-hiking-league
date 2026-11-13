import assert from 'node:assert/strict'
import test from 'node:test'
import { PDFDocument } from 'pdf-lib'
import type { Invoice } from '../app/lib/shop/invoices'
import type { ShopOrder } from '../app/lib/shop/orders'
import { PURCHASE_TEXT, WITHDRAWAL_TEXT } from '../app/lib/shop/legal'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://database.example.com'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'server'
process.env.RESEND_API_KEY = 'test'
process.env.SHOP_CONFIRMATIONS_ENABLED = 'true'
const { sendOrderConfirmation } = await import('../app/lib/shop/confirmations')
const id = 'aa69e7d8-5111-4c3a-b59a-8e892a067970'
const address = { firstName: 'Mia', lastName: 'Muster', addressLine1: 'Teststraße 1', addressLine2: '',
  postCode: '10178', city: 'Berlin', country: 'DE', email: 'mia@example.com', phone: '' } as const
const invoice = {
  order_id: id, number: 'UHL-FIXTURE', issued_at: '2026-11-08T08:00:00Z', mode: 'live',
  pdf_base64: Buffer.from('original invoice fixture').toString('base64'),
  snapshot: {
    seller: { name: 'ULTIMATE', address: 'Test', email: 'shop@example.com', taxNumber: '' }, buyer: address,
    lines: [{ sku: 'CAL', name: 'Wanderkalender', quantity: 1, unit_price_cents: 2990, total_cents: 2990 }],
    shippingCents: 574, totalCents: 3564, paidAt: '2026-11-08T08:00:00Z', currency: 'EUR',
    terms: { purchase: PURCHASE_TEXT, withdrawal: WITHDRAWAL_TEXT },
  },
} satisfies Invoice

test('Stripe and PayPal order confirmations keep the invoice and attach consumer information', async () => {
  const original = globalThis.fetch
  try {
    for (const provider of ['stripe', 'paypal'] as const) {
      const calls: string[] = []
      globalThis.fetch = async (input, init) => {
        const url = new URL(input instanceof Request ? input.url : String(input))
        calls.push(url.pathname)
        if (url.pathname.endsWith('/shop_issue_invoice')) return Response.json([invoice])
        if (url.pathname.endsWith('/shop_invoices')) return Response.json([{ order_id: id }])
        if (url.hostname !== 'api.resend.com') throw Error('Unexpected external request')
        assert.equal(new Headers(init?.headers).get('idempotency-key'), 'order-confirmation-' + id)
        const email = JSON.parse(String(init?.body))
        assert.match(email.text, /Hallo Mia/)
        assert.match(email.text, new RegExp(id))
        assert.match(email.text, /Wanderkalender/)
        assert.match(email.text, /35,64/)
        assert.match(email.text, /Teststraße 1/)
        assert.doesNotMatch(email.text, /binnen vierzehn Tagen/)
        assert.equal(email.attachments[0].content, invoice.pdf_base64)
        assert.equal(email.attachments[1].filename, 'Verbraucherinformationen.pdf')
        const pdf = await PDFDocument.load(Buffer.from(email.attachments[1].content, 'base64'))
        assert.ok(pdf.getPageCount() >= 2)
        return Response.json({ id: 'mock-message' })
      }
      await sendOrderConfirmation({ id, mode: 'live', status: 'paid', provider, address } as ShopOrder)
      assert.deepEqual(calls, ['/rest/v1/rpc/shop_issue_invoice', '/rest/v1/shop_invoices', '/emails', '/rest/v1/shop_invoices'])
    }
  } finally {
    globalThis.fetch = original
  }
})
