'use strict'
const assert = require('node:assert/strict')
const { chromium } = require(process.env.UHL_PLAYWRIGHT || 'playwright')
const base = process.env.UHL_REVIEW_TEST_ORIGIN ?? 'http://127.0.0.1:55831'

async function test() {
  const browser = await chromium.launch(process.env.UHL_CHROME ? { executablePath: process.env.UHL_CHROME } : {})
  try {
    const page = await browser.newPage({ viewport: { width: 430, height: 900 } })
    await page.addInitScript(() => localStorage.setItem('uhl_cookie_consent', 'necessary_only'))
    const posts = []
    page.on('request', request => {
      if (request.method() === 'POST') posts.push(new URL(request.url()).pathname)
    })
    const visit = async path => assert.equal((await page.goto(base + path)).status(), 200, path)
    await visit('/de/leaderboard')
    const past = page.locator('a[href="/de/events/abnahme-felsenweg-2026"]')
    await past.getByText('5 Bewertungen', { exact: true }).waitFor()
    const score = await past.getByText(/★.*\/5/).innerText()
    await visit('/de/events')
    const upcoming = page.locator('div.rounded-3xl').filter({ has: page.locator('a[href="/de/events/abnahme-felsenweg-2027"]') })
    assert.equal(await upcoming.getByText('5 Bewertungen', { exact: true }).count(), 1)
    assert.equal(await upcoming.getByText(/★.*\/5/).innerText(), score)
    await visit('/de/events/abnahme-felsenweg-2026')
    const titleBadge = page.locator('a[href="#reviews"]')
    assert.equal(await titleBadge.getByText(/★.*\/5/).innerText(), score)
    await titleBadge.getByText('5 Bewertungen', { exact: true }).waitFor()

    await visit('/review-acceptance')
    await page.getByRole('button', { name: 'Als Test-Hiker', exact: true }).click()
    await page.getByText('Test-Hiker ist aktiv.', { exact: true }).waitFor()
    await visit('/review-acceptance/activity?edit=missing')
    await page.getByRole('button', { name: 'Eintrag bearbeiten', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Ich möchte diese Veranstaltung bewerten.' }).check()
    const stars = await page.getByRole('radio', { name: '4/5 Sterne', exact: true }).all()
    assert.equal(stars.length, 7)
    for (const star of stars) await star.locator('..').click()
    await page.getByRole('textbox', { name: 'Kommentar (optional)' }).first().fill('Bewertung nachgetragen ohne Wanderkorrektur.')
    await page.getByRole('button', { name: 'Bewertung einreichen' }).click()
    await page.getByText('Deine Bewertung wurde zur Prüfung eingereicht.', { exact: true }).waitFor()

    await visit('/review-acceptance/activity?edit=1')
    await page.getByRole('button', { name: 'Eintrag bearbeiten', exact: true }).click()
    await page.getByRole('button', { name: 'Überarbeiten', exact: true }).click()
    await page.getByRole('textbox', { name: 'Kommentar (optional)' }).first().fill('Überarbeitung ohne Wanderkorrektur.')
    await page.getByRole('button', { name: 'Bewertung einreichen' }).click()
    await page.getByText('Überarbeitung in Prüfung', { exact: true }).waitFor()
    assert.equal(posts.filter(path => path.endsWith('/uhl_submit_review')).length, 1)
    assert.equal(posts.filter(path => path.endsWith('/uhl_revise_review')).length, 1)
    assert.equal(posts.filter(path => path.endsWith('/record_corrections')).length, 0)

    await visit('/review-acceptance')
    await page.getByRole('button', { name: 'Admin-Moderation öffnen' }).click()
    const fixture = page.locator('article').filter({ hasText: 'Mika Morgenrot' })
    await fixture.waitFor()
    const expected = [
      ['Streckenführung', 'Streckenführung: abwechslungsreich.\nZweite Zeile zum Streckenverlauf.'],
      ['Verpflegungspunkte', 'Verpflegung: Wasser und Obst.'],
      ['Beschilderung', 'Beschilderung: ein Hinweis an der Gabelung fehlte.'],
      ['Preis-Leistungs-Verhältnis', 'Preis-Leistung: der Preis war angemessen.'],
      ['Kundenservice', 'Service: die Antwort kam am selben Tag.'],
      ['Weiterempfehlung', 'Empfehlung: auch für erfahrene Wanderer.'],
      ['Veranstalter', 'Veranstalter: der Start war gut organisiert.'],
    ]
    const rows = fixture.locator('li')
    assert.equal(await rows.count(), 7)
    for (const [index, [heading, text]] of expected.entries()) {
      assert.equal(await rows.nth(index).locator('span').innerText(), heading)
      const comment = rows.nth(index).locator('p')
      assert.equal(await comment.innerText(), text)
      assert.equal(await comment.isVisible(), true)
    }
    await page.setViewportSize({ width: 1200, height: 900 })
    assert.equal(await fixture.getByRole('button', { name: 'Kommentar entfernen' }).count(), 7)
    await page.getByText('Bewertung nachgetragen ohne Wanderkorrektur.', { exact: true }).waitFor()
    await page.getByText('Überarbeitung ohne Wanderkorrektur.', { exact: true }).waitFor()
    console.log('Seven moderation comments, independent review changes, shared series rating passed')
  } finally {
    await browser.close()
  }
}
test().catch(error => { console.error(error); process.exitCode = 1 })
