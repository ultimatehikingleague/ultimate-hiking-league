'use strict'

const assert = require('node:assert/strict')
const { chromium } = require(process.env.UHL_PLAYWRIGHT || 'playwright')
const { response, user } = require('./release-fixture.cjs')
const base = process.env.UHL_REVIEW_TEST_ORIGIN ?? 'http://127.0.0.1:55826'
const languages = {
  de: ['Veranstaltungsranking', 'Veranstalterranking', 'Verifizierter Teilnehmer'],
  en: ['Event rankings', 'Organizer rankings', 'Verified participant'],
  fr: ['Classement des événements', 'Classement des organisateurs', 'Participant vérifié'],
  nl: ['Evenementenranglijst', 'Organisatorenranglijst', 'Geverifieerde deelnemer'],
  it: ['Classifica degli eventi', 'Classifica degli organizzatori', 'Partecipante verificato'],
  es: ['Clasificación de eventos', 'Clasificación de organizadores', 'Participante verificado'],
  pl: ['Ranking wydarzeń', 'Ranking organizatorów', 'Zweryfikowany uczestnik'],
  cs: ['Žebříček akcí', 'Žebříček pořadatelů', 'Ověřený účastník'],
}

async function run() {
  const browser = await chromium.launch(process.env.UHL_CHROME ? { executablePath: process.env.UHL_CHROME } : {})
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 950 } })
    await context.addInitScript(fixtureUser => {
      localStorage.setItem('uhl_cookie_consent', 'necessary_only')
      const session = JSON.stringify({
        access_token: 'fixture-token', refresh_token: 'fixture-token', expires_at: 1890000000, user: fixtureUser,
      })
      for (const key of ['sb-build-fixture-auth-token','sb-astdepkrdkmufsydxviz-auth-token']) localStorage.setItem(key,session)
    }, user)

    await context.route('**/*', route => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.origin === base) return route.continue()
      if (url.hostname !== 'build-fixture.invalid' && !url.hostname.endsWith('.supabase.co')) return route.abort()
      const headers = {
        'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,HEAD,OPTIONS',
        'access-control-allow-headers': '*',
      }
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
      return route.fulfill({ json: response(url, new Headers(request.headers())).body, headers })
    })
    const page = await context.newPage()
    const visit = async path => assert.equal((await page.goto(base + path)).status(), 200, path)
    for (const [locale, [events, organizers, verified]] of Object.entries(languages)) {
      await visit('/' + locale + '/leaderboard/event-reviews')
      await page.getByRole('heading', { name: events, exact: true }).waitFor()
      const organizerLink = page.getByRole('link', { name: organizers, exact: true })
      assert.equal(await organizerLink.getAttribute('href'), '/' + locale + '/leaderboard/organizer-reviews')
      await organizerLink.click()
      await page.getByRole('heading', { name: organizers, exact: true }).waitFor()
      await visit('/' + locale + '/organizers/fixture-organizer')
      await page.getByRole('heading', { name: 'Fixture Organizer', exact: true }).waitFor()
      await visit('/' + locale + '/events/fixture-trail')
      const overview = page.locator('details#reviews')
      assert.equal(await overview.getAttribute('open'),null)
      await page.locator('a[href="#reviews"]').click()
      await overview.getByText(verified, { exact: false }).first().waitFor()
      assert.equal(await overview.getByRole('radio').count(),0)
      assert.equal(await page.locator('html').getAttribute('lang'), locale)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), locale)
    }
    await visit('/de/events')
    await page.getByText('5 Bewertungen', {exact:true}).waitFor()
    await visit('/admin/event-reviews')
    await page.getByText('Keine Bewertungen in dieser Ansicht.', {exact:true}).waitFor()
    console.log('Review browser smoke passed in all eight platform languages')
  } finally {
    await browser.close()
  }
}

run().catch(error => { console.error(error); process.exitCode = 1 })
