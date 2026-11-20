import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parse, TYPE } from '@formatjs/icu-messageformat-parser'
import { IntlMessageFormat } from 'intl-messageformat'

const read = name => JSON.parse(readFileSync(new URL(`../messages/${name}.json`, import.meta.url), 'utf8'))
const german = read('de')
const czech = read('cs')
const hash = value => createHash('sha256').update(value).digest('hex')
const categories = new Intl.PluralRules('cs').resolvedOptions().pluralCategories.sort()

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
      if (locale === 'cs' && node.type === TYPE.plural && node.pluralType === 'cardinal') {
        assert.deepEqual(keys.filter(key => !key.startsWith('=')).sort(), categories)
      }
      for (const part of Object.values(node.options)) visit(part.value)
    }
  }
  visit(parse(message))
  return [...new Set(tokens)].sort()
}

assert.deepEqual(Object.keys(czech), Object.keys(german))
const reviewed = []
for (const [namespace, source] of Object.entries(german)) {
  assert.deepEqual(Object.keys(czech[namespace]), Object.keys(source), namespace)
  for (const [key, germanText] of Object.entries(source)) {
    const name = `${namespace}.${key}`
    const czechText = czech[namespace][key]
    assert.equal(typeof czechText, 'string', name)
    assert.ok(czechText.trim(), name)
    assert.deepEqual(signature(czechText, 'cs'), signature(germanText, 'de'), name)
    assert.deepEqual(czechText.match(/[\w.+-]+@[\w.-]+\.\w+/g), germanText.match(/[\w.+-]+@[\w.-]+\.\w+/g), name)
    reviewed.push(`${name}\t${hash(germanText)}\t${hash(czechText)}`)
  }
}

const expected = [
  [0, '0 akcí'],
  [1, '1 akce'],
  [2, '2 akce'],
  [4, '4 akce'],
  [5, '5 akcí'],
  [1.5, '1,5 akce'],
]
const count = new IntlMessageFormat(czech.eventCalendar.eventCount, 'cs')
for (const [value, output] of expected) assert.equal(count.format({ count: value }), output)

if (process.argv.includes('--manifest')) {
  console.log('Schlüssel\tDE (SHA-256)\tCS (SHA-256)')
  console.log(reviewed.join('\n'))
} else {
  console.log(`${reviewed.length} identische Schlüsselpfade. ICU, tschechische Pluralformen, E-Mail-Adressen und Zahlbeispiele geprüft.`)
}
