'use strict'
const assert = require('node:assert/strict')
const { chromium } = require(process.env.UHL_PLAYWRIGHT || 'playwright')
const site = process.env.UHL_REVIEW_TEST_ORIGIN ?? 'http://127.0.0.1:55831'
const languages = {
  de: 'Registrieren', en: 'Register', fr: 'S’inscrire', nl: 'Registreren',
  it: 'Registrati', es: 'Registrarse', pl: 'Zarejestruj się', cs: 'Zaregistrovat se',
}

async function main() {
  const browser = await chromium.launch(process.env.UHL_CHROME ? { executablePath: process.env.UHL_CHROME } : {})
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 850 } })
    await page.addInitScript(() => localStorage.setItem('uhl_cookie_consent','necessary_only'))
    const visit = async path => assert.equal((await page.goto(site + path)).status(), 200, path)
    const invitation = () => page.locator('a[href*="mode=register"]').first()
    const example = 'Abwechslungsreiche Strecke mit schönen Aussichten.'
    for (const [locale, label] of Object.entries(languages)) {
      const eventPath = '/' + locale + '/events/abnahme-felsenweg-2026'
      const response = await page.request.get(site + eventPath)
      assert.equal(response.status(), 200)
      assert.ok((await response.text()).includes(example), locale + ' server-rendered comment')
      await visit(eventPath + '#reviews')
      await invitation().waitFor()
      assert.equal(await invitation().innerText(), label)
      assert.equal(await page.locator('#reviews input').count(), 0)
      const badge = await page.locator('a[href="#reviews"]').evaluate(el => {
        const badge = el.firstElementChild
        return { centred: getComputedStyle(badge).textAlign === 'center' && getComputedStyle(badge).flexDirection === 'column', fit: el.offsetWidth < el.parentElement.offsetWidth,
          overflow: document.documentElement.scrollWidth > innerWidth + 1 }
      })
      assert.ok(badge.centred && badge.fit && !badge.overflow, locale + ' mobile title badge')
      for (const route of ['/leaderboard/event-reviews','/leaderboard/organizer-reviews','/organizers/abnahme-wanderwerk']) {
        await visit('/' + locale + route)
        await invitation().waitFor()
      }
    }
    await Promise.all([page.waitForURL(url => url.pathname.endsWith("/login") && url.searchParams.get("mode") === "register"), invitation().click()])
    assert.match(page.url(), /\/login\?mode=register/)
    await page.getByRole('button', { name: /registr|zaregistrovat/i }).last().waitFor()
    await visit('/review-acceptance')
    await page.getByRole('button', { name: 'Als Test-Hiker', exact: true }).click()
    await page.getByText('Test-Hiker ist aktiv.', { exact: true }).waitFor()
    await visit('/de/events/abnahme-felsenweg-2026#reviews')
    await page.getByText(example, { exact: false }).first().waitFor()
    assert.equal(await invitation().count(), 0)
    await visit('/de/leaderboard/event-reviews')
    assert.equal(await invitation().count(), 0)
    const api = 'http://127.0.0.1:55832/rest/v1/rpc/'
    for (const [func, data] of [
      ['uhl_submit_review',{p_event:700,p_record:7001,p_stars:[4,4,4,4,4,4,4],p_comments:Array(7).fill(null),p_show_name:false}],
      ['uhl_revise_review',{p_review:1,p_stars:[4,4,4,4,4,4,4],p_comments:Array(7).fill(null),p_show_name:false}],
    ]) {
      assert.equal((await page.request.post(api + func, { data })).status(),403)
    }
    const reviews = await (await page.request.post(api + 'uhl_public_reviews', { data:{p_event:700,p_organizer:null} })).json()
    const cursor = reviews[1].id
    const next = await page.request.get(site + '/de/events/abnahme-felsenweg-2026?before=' + cursor)
    assert.equal(next.status(),200)
    assert.match(await next.text(),new RegExp('rel="canonical" href="[^"]+\\?before='+cursor+'"'))
    console.log('Public review content, guest invite in eight languages, mobile badge, cursor and write protection passed')
  } finally {
    await browser.close()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
