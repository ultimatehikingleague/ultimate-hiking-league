import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parse, TYPE } from '@formatjs/icu-messageformat-parser'
import { IntlMessageFormat } from 'intl-messageformat'

const read = name => JSON.parse(readFileSync(new URL(`../messages/${name}.json`, import.meta.url), 'utf8'))
const german = read('de')
const spanish = read('es')
const hash = value => createHash('sha256').update(value).digest('hex')
const categories = new Intl.PluralRules('es').resolvedOptions().pluralCategories.sort()

function signature(message, locale) {
  const tokens = []
  function visit(nodes) {
    for (const node of nodes) {
      if (node.type === TYPE.literal || node.type === TYPE.pound) continue
      tokens.push(`${node.type}:${node.value}`)
      if (node.children) visit(node.children)
      if (!node.options) continue
      const keys = Object.keys(node.options)
      const choices = keys.filter(key => node.type === TYPE.select || key.startsWith('='))
      tokens.push(`options:${node.value}:${node.pluralType ?? ''}:${node.offset ?? ''}:${choices.sort()}`)
      if (locale === 'es' && node.type === TYPE.plural && node.pluralType === 'cardinal') {
        assert.deepEqual(keys.filter(key => !key.startsWith('=')).sort(), categories)
      }
      for (const part of Object.values(node.options)) visit(part.value)
    }
  }
  visit(parse(message))
  return [...new Set(tokens)].sort()
}

assert.deepEqual(Object.keys(spanish), Object.keys(german))
const reviewed = []
for (const [namespace, source] of Object.entries(german)) {
  assert.deepEqual(Object.keys(spanish[namespace]), Object.keys(source), namespace)
  for (const [key, germanText] of Object.entries(source)) {
    const name = `${namespace}.${key}`
    const spanishText = spanish[namespace][key]
    assert.equal(typeof spanishText, 'string', name)
    assert.ok(spanishText.trim(), name)
    assert.deepEqual(signature(spanishText, 'es'), signature(germanText, 'de'), name)
    assert.deepEqual(spanishText.match(/[\w.+-]+@[\w.-]+\.\w+/g), germanText.match(/[\w.+-]+@[\w.-]+\.\w+/g), name)
    reviewed.push(`${name}\t${hash(germanText)}\t${hash(spanishText)}`)
  }
}

const expected = [
  [0, '0 eventos'],
  [1, '1 evento'],
  [2, '2 eventos'],
  [1.5, '1,5 eventos'],
  [1_000_000, '1.000.000 eventos'],
]
const count = new IntlMessageFormat(spanish.eventCalendar.eventCount, 'es')
for (const [value, output] of expected) assert.equal(count.format({ count: value }), output)

if (process.argv.includes('--manifest')) {
  console.log('Schlüssel\tDE (SHA-256)\tES (SHA-256)')
  console.log(reviewed.join('\n'))
} else {
  console.log(`${reviewed.length} identische Schlüsselpfade. ICU, spanische Pluralformen, E-Mail-Adressen und Zahlbeispiele geprüft.`)
}
