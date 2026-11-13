import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { createGarminAuthorization } from '../app/lib/activity/garmin-oauth.server'

test('Garmin authorization uses S256 and independent, fresh state and verifier', () => {
  const callback = 'https://uhl.example/api/garmin/callback'
  const attempt = createGarminAuthorization('test-client', callback)
  const url = new URL(attempt.authorizationUrl)

  assert.equal(url.origin + url.pathname, 'https://connect.garmin.com/oauth2Confirm')
  assert.equal(url.searchParams.get('response_type'), 'code')
  assert.equal(url.searchParams.get('client_id'), 'test-client')
  assert.equal(url.searchParams.get('redirect_uri'), callback)
  assert.equal(url.searchParams.get('state'), attempt.state)
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
  assert.equal(url.searchParams.get('code_challenge'), createHash('sha256').update(attempt.verifier).digest('base64url'))
  assert.match(attempt.verifier, /^[A-Za-z0-9_-]{43}$/)
  assert.ok(!url.toString().includes(attempt.verifier))
  assert.notEqual(attempt.state, attempt.verifier)

  const retry = createGarminAuthorization('test-client', callback)
  assert.notEqual(retry.state, attempt.state)
  assert.notEqual(retry.verifier, attempt.verifier)
})

test('Garmin authorization rejects insecure callback configuration', () => {
  for (const callback of [
    'http://uhl.example/callback',
    'https://user:password@uhl.example/callback',
    'https://uhl.example/callback#fragment',
  ]) {
    assert.throws(() => createGarminAuthorization('test-client', callback))
  }

  assert.doesNotThrow(() => createGarminAuthorization('test-client', 'http://localhost:3000/callback'))
})
