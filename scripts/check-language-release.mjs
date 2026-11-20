import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const port = Number(process.env.UHL_RELEASE_PORT ?? 55365)
const canonical = 'https://www.ultimatehikingleague.com'
const languages = ['de', 'en']
const routes = JSON.parse(readFileSync(new URL('../i18n/public-paths.json', import.meta.url), 'utf8'))
routes.push('/events/trail-fixture', '/challenges/christmas-challenge-2026', '/1')
const publicPaths = new Set(['/rules', '/faq'])
const canary = 'uhl-isolation-test-canary'
const cached = new Map()

async function read(path, host = '127.0.0.1', headers = {}) {
  const response = await fetch(`http://${host}:${port}${path}`, {
    headers, redirect: 'manual', signal: AbortSignal.timeout(12000),
  })
  return { response, body: await response.text() }
}

let checks = 0
for (const host of ['127.0.0.1', 'localhost']) {
  for (const lang of languages) {
    const opposite = lang === 'de' ? 'en' : 'de'
    for (const route of routes) {
      const path = `/${lang}${route === '/' ? '' : route}`
      for (const format of ['html', 'rsc']) {
        const { response, body } = await read(path, host, {
          'Accept-Language': opposite,
          Cookie: `uhl_language=${opposite}; example_session=${canary}`,
          ...(format === 'rsc' ? { RSC: '1' } : {}),
        })
        assert.equal(response.status, 200, path + ' ' + format)
        assert.doesNotMatch(response.headers.get('x-robots-tag') ?? '', /noindex/)
        assert.ok(!body.includes(canary), 'cookie value in response')
        assert.equal(response.headers.get('set-cookie'), null)
        assert.match(response.headers.get('vary') ?? '', /\brsc\b/i)
        assert.match(response.headers.get('content-type') ?? '', format === 'html' ? /text\/html/ : /text\/x-component/)
        const cache = response.headers.get('cache-control') ?? ''
        if (publicPaths.has(route)) {
          assert.match(cache, /s-maxage=/, path)
          const hash = createHash('sha256').update(body).digest('hex')
          const key = path + ':' + format
          if (cached.has(key)) assert.equal(hash, cached.get(key), key)
          cached.set(key, hash)
        } else {
          assert.match(cache, /private.*no-store/, path)
        }
        if (format === 'html') {
          assert.ok(body.includes(`<html lang="${lang}"`), path)
          assert.ok(body.includes(`rel="canonical" href="${canonical}${path}"`), path)
          for (const alt of [...languages, 'x-default']) {
            const expectedPath = route === '/' ? '' : route
            assert.ok(body.includes(`hrefLang="${alt}" href="${canonical}/${alt === 'x-default' ? 'en' : alt}${expectedPath}"`), path + ' ' + alt)
          }
        }
        checks++
      }
    }
  }
}

for (const route of ['/rules','/faq','/login','/reset-password','/account','/shop/checkout','/shop/bestellung']) {
  const { response } = await read(route)
  assert.equal(response.status, 200, route)
  assert.match(response.headers.get('cache-control') ?? '', /private.*no-store/, route)
}
for (const route of ['/de/login','/en/api/shop/order','/de/milestone-shop','/fr/faq']) {
  assert.equal((await read(route)).response.status, 404, route)
}
for (const [cookie, browser, expected] of [['de','en','de'], ['en','de','en'], ['', 'fr-FR','en']]) {
  const { body } = await read('/faq', '127.0.0.1', {
    Cookie: cookie ? `uhl_language=${cookie}` : '', 'Accept-Language': browser,
  })
  assert.ok(body.includes(`<html lang="${expected}"`))
}
console.log(`${checks} HTML/RSC checks across ${routes.length} routes, two languages and two local hostnames passed.`)
