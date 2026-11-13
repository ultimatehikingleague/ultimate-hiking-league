// A narrow local receiver for PayPal sandbox callbacks. Never proxies shop pages.
const http = require('node:http')
const { loadEnvConfig } = require('@next/env')
const path = require('node:path')
const route = '/api/shop/paypal/webhook'
const signatureHeaders = ['paypal-auth-algo', 'paypal-cert-url', 'paypal-transmission-id', 'paypal-transmission-sig', 'paypal-transmission-time']
function createRelay(upstream = 'http://localhost:3000') {
  return http.createServer(async (req, res) => {
    if (req.url !== route) { res.writeHead(404); res.end(); return }
    if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }); res.end(); return }
    if (!signatureHeaders.every(name => typeof req.headers[name] === 'string')) { res.writeHead(400); res.end('Missing signature'); return }
    const chunks = []; let size = 0
    try {
      for await (const chunk of req) {
        size += chunk.length
        if (size > 1000000) { res.writeHead(413); res.end(); return }
        chunks.push(chunk)
      }
      const headers = { 'content-type': 'application/json' }
      for (const name of signatureHeaders) headers[name] = req.headers[name]
      const response = await fetch(upstream + route, { method: 'POST', headers, body: Buffer.concat(chunks), redirect: 'error', signal: AbortSignal.timeout(60000) })
      // No cookies, credentials or upstream error details are exposed by this relay.
      res.writeHead(response.status, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); res.end(response.ok ? 'Received' : 'Not accepted')
    } catch { if (!res.headersSent) res.writeHead(502); res.end('Receiver unavailable') }
  })
}
module.exports = { createRelay }
if (require.main === module) {
  loadEnvConfig(path.resolve(__dirname, '..'))
  if (process.env.SHOP_PAYMENT_MODE !== 'test' || process.env.SHOP_LIVE_APPROVED === 'true') { console.error('Nur für den gesperrten lokalen Testbetrieb.'); process.exit(1) }
  const server = createRelay()
  server.requestTimeout = 65000; server.headersTimeout = 10000
  server.listen(3132, '127.0.0.1', () => console.log('PayPal-Testempfänger bereit auf 127.0.0.1:3132. Nur POST /api/shop/paypal/webhook ist zugelassen.'))
}
