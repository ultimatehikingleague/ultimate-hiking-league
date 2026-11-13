import { readGarminScreenshot } from './garmin-screenshot'
import { fullMinutes } from './normalize'

export const screenshotLabels = {
  distance: 'Distanz (km)',
  ascent: 'Aufstieg (m)',
  descent: 'Abstieg (m)',
  date: 'Datum',
  elapsed: 'Gesamtzeit',
  moving: 'Bewegungszeit',
  title: 'Titel',
}
export type ScreenshotField = keyof typeof screenshotLabels
export type ScreenshotValues = Partial<Record<ScreenshotField, string>>

const number = (value: string) => Number(value.replace(',', '.'))
const distance = /(\d{1,4}(?:[,.]\d{1,3})?)\s*km\b/i
const elevation = /(?<![\d.,])(\d{1,5}|\d{1,2}[., ]\d{3})\s*(?:hm|m)\b/i
const duration = /^(?:(\d{1,3}):([0-5]\d)(?::([0-5]\d))?(?:\s*h)?|(\d{1,3})\s*(?:h|std)\.?(?:\s*(\d{1,2})\s*min)?)$/i
const germanDate = /\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/
const metricPatterns = [
  ['distance', /^(?:gesamtdistanz|distanz(?: des tracks)?|strecke|distance|total distance)\b(?!\s+(?:berg|in der))/i, distance],
  ['ascent', /^(?:aufstieg|höhenmeter bergauf|positiver höhenunterschied|elevation gain|ascent)\b/i, elevation],
  ['descent', /^(?:abstieg|höhenmeter bergab|elevation loss|descent)\b/i, elevation],
  ['elapsed', /^(?:gesamtzeit|verstrichene zeit|elapsed time|total elapsed time|aufgezeichnete zeit\s*\([^)]*pausen[^)]*\))/i, duration],
  ['moving', /^(?:bewegungszeit|zeit in bewegung|moving time|time in motion)\b/i, duration],
] as const

export function readScreenshotValues(texts: (string | { text: string; tsv: string | null })[]) {
  const candidates = new Map<ScreenshotField, Set<string>>()
  const add = (field: ScreenshotField, value: string | null) => {
    if (!value) return
    const values = candidates.get(field) ?? new Set<string>()
    values.add(value)
    candidates.set(field, values)
  }
  for (const input of texts) {
    const garmin = typeof input !== 'string' && input.tsv ? readGarminScreenshot(input.tsv) : null
    if (garmin) {
      for (const [field, value] of Object.entries(garmin)) add(field as ScreenshotField, value)
      continue
    }
    const text = typeof input === 'string' ? input : input.text
    const lines = text.split(/\n/).map(line => line.trim()).filter(Boolean)
    for (const [index, line] of lines.entries()) {
      for (const [field, label, pattern] of metricPatterns) {
        const labelMatch = line.match(label)
        if (!labelMatch) continue
        const suffix = line.slice(labelMatch[0].length).trim().replace(/^[:|]\s*/, '')
        const candidate = suffix || lines[index + 1] || ''
        const match = candidate.match(pattern)
        if (match?.[0] !== candidate) continue
        if (!match) continue
        if (field === 'elapsed' || field === 'moving') {
          const hours = Number(match[1] ?? match[4])
          const minutes = Number(match[2] ?? match[5] ?? 0)
          const seconds = Number(match[3] ?? 0)
          if (minutes < 60 && hours * 60 + minutes > 0) add(field, fullMinutes(hours * 3600 + minutes * 60 + seconds))
        } else if (field === 'distance') {
          const km = number(match[1])
          if (km > 0) add(field, String(km))
        } else {
          add(field, match[1].replace(/[., ]/g, ''))
        }
      }
      const date = line.match(germanDate)
      if (date) {
        const iso = [date[3], date[2].padStart(2, '0'), date[1].padStart(2, '0')].join('-')
        const parsed = new Date(iso)
        if (Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso) add('date', iso)
      }
      const title = line.match(/^(?:(?:aktivitätstitel|aktivitätsname|titel|activity name)\s*:\s*|(?=Garmin\s*\|))(.{3,120})$/i)
      if (title) add('title', title[1])
    }
  }
  const values: ScreenshotValues = {}
  const conflicts: ScreenshotField[] = []
  for (const [field, matches] of candidates) {
    if (matches.size === 1) values[field] = [...matches][0]
    else conflicts.push(field)
  }
  return { values, conflicts }
}

export const screenshotProofPrefix = 'screenshot-proofs:'
export function screenshotProofUrls(reference: string): string[] {
  try {
    const urls: unknown = JSON.parse(reference.slice(screenshotProofPrefix.length))
    return Array.isArray(urls) ? urls.filter(url => {
      if (typeof url !== 'string') return false
      const parsed = new URL(url)
      return ['http:', 'https:'].includes(parsed.protocol) && parsed.pathname.startsWith('/storage/v1/object/public/record-proofs/')
    }) : []
  } catch {
    return []
  }
}
