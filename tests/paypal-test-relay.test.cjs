const test = require('node:test')
const assert = require('node:assert/strict')
const { createRelay } = require('../scripts/paypal-test-relay.cjs')
test('PayPal relay blocks shop pages, query strings and unsigned requests', async () => {
  const server = createRelay('http://127.0.0.1:1')
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const origin = `http://127.0.0.1:${server.address().port}`
    for (const route of ['/', '/shop', '/api/shop/order', '/api/shop/paypal/webhook?x=1']) assert.equal((await fetch(origin + route)).status, 404)
    assert.equal((await fetch(origin + '/api/shop/paypal/webhook')).status, 405)
    assert.equal((await fetch(origin + '/api/shop/paypal/webhook', { method: 'POST', body: '{}' })).status, 400)
  } finally { await new Promise(resolve => server.close(resolve)) }
})
