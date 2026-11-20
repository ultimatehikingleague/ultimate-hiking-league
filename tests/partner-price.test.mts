import assert from 'node:assert/strict'
import test from 'node:test'
import { PARTNER_PACKAGES } from '../app/lib/partners/packages'
import { bookingPriceInput, parseBookingPrice } from '../app/lib/partners/price'

test('every advertised list price round-trips in the booking field', () => {
  for (const packages of Object.values(PARTNER_PACKAGES)) {
    for (const pkg of packages) {
      for (const offer of pkg.offers) {
        assert.equal(parseBookingPrice(bookingPriceInput(offer.cents)), offer.cents)
      }
    }
  }
})

test('negotiated prices preserve cents and distinguish free from missing', () => {
  assert.equal(parseBookingPrice('0,00'), 0)
  assert.equal(parseBookingPrice(' 123,45 '), 12345)
  assert.equal(parseBookingPrice('19.7'), 1970)
  assert.equal(bookingPriceInput(null), '')
  for (const invalid of ['', '-1', '5,555', '1e2', '21474836,48']) {
    assert.equal(parseBookingPrice(invalid), null)
  }
  assert.equal(parseBookingPrice('21474836,47'), 2147483647)
})
