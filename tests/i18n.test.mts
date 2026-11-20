import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { PURCHASE_TEXT, WITHDRAWAL_TEXT } from '../app/lib/shop/legal.js'
import { parse } from '@formatjs/icu-messageformat-parser'
import { createTranslator } from 'next-intl'
import { formatRankingDistance } from '../i18n/display.js'
import { resolveLocale } from '../i18n/locales.js'

test('valid language preference wins, otherwise use the first weighted supported browser language', () => {
  assert.equal(resolveLocale('en', 'de-DE,en;q=0.5'), 'en')
  assert.equal(resolveLocale('de', 'en-GB'), 'de')
  assert.equal(resolveLocale(null, 'de-AT,en;q=0.5'), 'de')
  assert.equal(resolveLocale('fr', 'en;q=0.4,de;q=0.8'), 'de')
  assert.equal(resolveLocale(null, 'fr-FR'), 'en')
  assert.equal(resolveLocale(null, null), 'en')
  assert.equal(resolveLocale(null, 'de;q=0,not_a_tag;q=1,fr'), 'en')
  assert.equal(resolveLocale(null, 'fr-FR,de;q=0.7,*;q=0.2'), 'de')
})

const catalog = (locale: string) => JSON.parse(readFileSync(new URL('../messages/' + locale + '.json', import.meta.url), 'utf8'))
const de = catalog('de'), en = catalog('en')

test('both catalogs have the same nonempty keys and reserved brand text stays out', () => {
  const placeholders = (message: string) => {
    const keys = new Set<string>()
    JSON.stringify(parse(message), (_key, node) => {
      if (node && typeof node === 'object' && typeof node.type === 'number' &&
          node.type > 0 && typeof node.value === 'string') keys.add(node.value)
      return node
    })
    return [...keys].sort()
  }
  assert.deepEqual(Object.keys(de).sort(), Object.keys(en).sort())
  for (const namespace of Object.keys(de)) {
    assert.deepEqual(Object.keys(de[namespace]).sort(), Object.keys(en[namespace]).sort(), namespace)
    for (const key of Object.keys(de[namespace])) {
      const entries = [de[namespace][key], en[namespace][key]]
      for (const entry of entries) {
        assert.ok(typeof entry === 'string' && entry.trim() && entry.normalize('NFC') === entry && !entry.includes('\uFFFD'), namespace + '.' + key)
        assert.ok(!entry.includes('Show us who you are.'))
      }
      assert.deepEqual(placeholders(entries[0]), placeholders(entries[1]), namespace + '.' + key)
    }
  }
  assert.equal(de.purchase.body, PURCHASE_TEXT)
  assert.equal(de.withdrawal.body, WITHDRAWAL_TEXT)
  const home = readFileSync(new URL('../app/home-page.tsx', import.meta.url), 'utf8')
  assert.ok(home.includes('Show us who you are.'))
})

test('each locale formats ICU placeholders, counts and rich-text distance', () => {
  for (const [locale, messages] of [['de', de], ['en', en]] as const) {
    const onError = (error: Error) => { throw error }
    const t = createTranslator({ locale, messages, namespace: 'ui', onError })
    assert.match(t('browserLanguage', { language: 'English' }), /English/)
    assert.match(t('participantCount', { count: 2 }), /2/)
    assert.match(t.markup('progress', { kilometres: '123', distance: value => value }), /123/)
  }
})

test('distance display uses locale separators and preserves the existing two decimals', () => {
  assert.equal(formatRankingDistance(1234.567, 'de'), '1.234,57')
  assert.equal(formatRankingDistance(1234.567, 'en'), '1,234.57')
  assert.equal(formatRankingDistance(null, 'en'), null)
})
