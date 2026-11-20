import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parse, TYPE } from '@formatjs/icu-messageformat-parser'
import { IntlMessageFormat } from 'intl-messageformat'

const read = name => JSON.parse(readFileSync(new URL(`../messages/${name}.json`, import.meta.url), 'utf8'))
const german = read('de')
const italian = read('it')
const hash = value => createHash('sha256').update(value).digest('hex')
const categories = new Intl.PluralRules('it').resolvedOptions().pluralCategories.sort()

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
      if (locale === 'it' && node.type === TYPE.plural && node.pluralType === 'cardinal') {
        assert.deepEqual(keys.filter(key => !key.startsWith('=')).sort(), categories)
      }
      for (const part of Object.values(node.options)) visit(part.value)
    }
  }
  visit(parse(message))
  return [...new Set(tokens)].sort()
}

assert.deepEqual(Object.keys(italian), Object.keys(german))
const reviewed = []
for (const [namespace, source] of Object.entries(german)) {
  assert.deepEqual(Object.keys(italian[namespace]), Object.keys(source), namespace)
  for (const [key, germanText] of Object.entries(source)) {
    const name = `${namespace}.${key}`
    const italianText = italian[namespace][key]
    assert.equal(typeof italianText, 'string', name)
    assert.ok(italianText.trim(), name)
    assert.deepEqual(signature(italianText, 'it'), signature(germanText, 'de'), name)
    assert.deepEqual(italianText.match(/[\w.+-]+@[\w.-]+\.\w+/g), germanText.match(/[\w.+-]+@[\w.-]+\.\w+/g), name)
    reviewed.push(`${name}\t${hash(germanText)}\t${hash(italianText)}`)
  }
}

const expected = [
  [0, '0 eventi'],
  [1, '1 evento'],
  [2, '2 eventi'],
  [1.5, '1,5 eventi'],
  [1_000_000, '1.000.000 eventi'],
]
const count = new IntlMessageFormat(italian.eventCalendar.eventCount, 'it')
for (const [value, output] of expected) assert.equal(count.format({ count: value }), output)

if (process.argv.includes('--manifest')) {
  console.log('Schlüssel\tDE (SHA-256)\tIT (SHA-256)')
  console.log(reviewed.join('\n'))
} else {
  console.log(`${reviewed.length} identische Schlüsselpfade. ICU, italienische Pluralformen, E-Mail-Adressen und Zahlbeispiele geprüft.`)
}
