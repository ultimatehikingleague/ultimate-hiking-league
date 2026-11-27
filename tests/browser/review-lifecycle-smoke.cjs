'use strict'
const assert=require('node:assert/strict')
const {chromium}=require(process.env.UHL_PLAYWRIGHT || 'playwright')
const base=process.env.UHL_REVIEW_TEST_ORIGIN ?? 'http://127.0.0.1:55831'
;(async()=>{
 const browser=await chromium.launch(process.env.UHL_CHROME ? { executablePath: process.env.UHL_CHROME } : {})
 try {
  const ctx=await browser.newContext({viewport:{width:1100,height:850}})
  await ctx.addInitScript(() => localStorage.setItem('uhl_cookie_consent','necessary_only'))
  const page=await ctx.newPage()
  page.on('pageerror',error=>console.error('page error',error))
  page.on('response',r=>{if(r.status()>=400&&r.url().includes('55832/'))console.error(r.status(),r.url())})
  async function visit(path, label){
   assert.equal((await page.goto(base+path,{timeout:35000})).status(),200,path)
   if(label) await page.getByText(label,{exact:true}).first().waitFor({timeout:15000})
  }
  async function role(button,status){
   await visit('/review-acceptance','UHL-Bewertungen · lokale Abnahme')
   await page.getByRole('button',{name:button,exact:true}).click()
   await page.getByRole('status').filter({hasText:status}).waitFor({timeout:12000})
  }
  const event='/de/events/abnahme-kammweg-2026#reviews'
  const replacement='Neue Fassung für den lokalen Abnahmetest.'
  await role('Als Test-Hiker','Test-Hiker ist aktiv.')
  await visit('/review-acceptance/activity?edit=1','Verifizierte Wanderleistung bearbeiten')
  await page.getByRole('button',{name:'Eintrag bearbeiten',exact:true}).click()
  await page.getByRole('button',{name:'Überarbeiten',exact:true}).click()
  assert.equal(await page.getByRole('radio',{name:'4/5 Sterne',exact:true}).first().isChecked(),true)
  await page.getByRole('textbox',{name:'Kommentar (optional)'}).first().fill(replacement)
  await page.getByRole('button',{name:'Bewertung einreichen',exact:true}).click()
  await page.getByText('Überarbeitung in Prüfung',{exact:true}).waitFor()
  assert.equal(await page.getByText(replacement,{exact:true}).count(),0)
  await page.getByRole('button',{name:'Anzeigenamen verbergen',exact:true}).click()
  await visit(event)
  await page.locator('#reviews').getByText('Alma Testhiker',{exact:true}).waitFor({state:'hidden'})
  await role('Als Test-Admin','Test-Admin ist aktiv.')
  await visit('/admin/event-reviews',replacement)
  const entry=page.locator('article').filter({hasText:replacement})
  await entry.getByRole('button',{name:'Freigeben',exact:true}).click()
  await page.getByText('Entscheidung gespeichert.',{exact:true}).waitFor()
  await visit(event,replacement)
  assert.equal(await page.locator('#reviews').getByText('Alma Testhiker',{exact:true}).count(),0)
  await visit('/de/leaderboard/event-reviews','Veranstaltungsranking')
  await visit('/de/leaderboard/organizer-reviews','Veranstalterranking')
  await visit('/de/organizers/abnahme-wanderwerk','Wanderwerk Felsental')
  await visit('/de/events','Felsental')
  await visit('/de/datenschutz#event-reviews','Bewertungen')
  await role('Als Test-Hiker','Test-Hiker ist aktiv.')
  await visit('/review-acceptance/activity?edit=1','Verifizierte Wanderleistung bearbeiten')
  await page.getByRole('button',{name:'Eintrag bearbeiten',exact:true}).click()
  page.once('dialog',dialog=>dialog.accept())
  await page.getByRole('button',{name:'Bewertung zurückziehen',exact:true}).click()
  await visit(event)
  await page.getByText(replacement,{exact:true}).waitFor({state:'hidden'})
  await visit('/de/leaderboard/event-reviews','Veranstaltungsranking')
  assert.equal(await page.getByRole('link',{name:/Kammweg/}).count(),0)
  console.log('Live local acceptance: revision, prior publication, name revocation, approval, withdrawal, rankings, organizer, calendar and privacy passed')
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
