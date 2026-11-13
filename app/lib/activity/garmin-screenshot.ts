import { fullMinutes } from './normalize'
import type { ScreenshotValues } from './screenshot'

type Word = { text: string; x: number; y: number; width: number; height: number; confidence: number }

function readLines(tsv: string) {
  const lines = new Map<string, Word[]>()
  for (const row of tsv.split('\n')) {
    const cells = row.split('\t')
    if (cells[0] !== '5' || !cells[11]?.trim()) continue
    const [x, y, width, height, confidence] = cells.slice(6, 11).map(Number)
    if (![x, y, width, height, confidence].every(Number.isFinite) || height <= 0) continue
    const key = cells.slice(1, 5).join('/')
    const words = lines.get(key) ?? []
    words.push({ text: cells[11].trim(), x, y, width, height, confidence })
    lines.set(key, words)
  }
  return [...lines.values()].map(line => line.sort((a, b) => a.x - b.x))
    .sort((a, b) => a[0].y - b[0].y)
}

const reliable = (word: Word) => word.confidence >= 70
const aligned = (word: Word, label: Word) => Math.abs(word.x - label.x) <= label.height

export function readGarminScreenshot(tsv: string): ScreenshotValues | null {
  const lines = readLines(tsv)
  const label = (pattern: RegExp) => lines.find(line => reliable(line[0]) && pattern.test(line.map(word => word.text).join(' ')))
  const notes = label(/^Notizen\b/i)
  const distance = label(/^Distanz\b(?!\s+des\b)/i)
  const elapsed = label(/^Gesamtzeit\b/i)
  const ascent = label(/^Anstieg gesamt\b/i)
  const metrics = [distance, elapsed, ascent].filter((line): line is Word[] => Boolean(line))
  const layoutAnchor = notes?.[0] ?? distance?.[0] ?? elapsed?.[0] ?? ascent?.[0]
  // Cropped views and OCR can omit the notes row or the adjacent Pace column.
  if (!layoutAnchor || metrics.filter(line => aligned(line[0], layoutAnchor)).length < 2) return null
  const heading = layoutAnchor

  function preceding(anchor: Word[] | undefined) {
    if (!anchor || !reliable(anchor[0]) || !aligned(anchor[0], heading) || (notes && anchor[0].y <= notes[0].y)) return []
    const first = anchor[0]
    const candidate = lines.findLast(line =>
      line[0].y < first.y && first.y - line[0].y <= 5 * first.height && aligned(line[0], first))
    if (!candidate || !reliable(candidate[0])) return []
    return candidate
  }

  const values: ScreenshotValues = {}
  const [km, unit] = preceding(distance)
  if (distance && km) {
    const attached = km.text.match(/^(\d{1,4}(?:[,.]\d{1,2})?)(km|«m)$/i)
    const separate = unit && reliable(unit) && unit.x - km.x <= 10 * distance[0].height
    const amount = attached?.[1] ?? km.text
    const symbol = attached?.[2] ?? (separate ? unit.text : '')
    // On the Garmin overview, the OCR can read the small “k” as “«”.
    if (/^\d{1,4}(?:[,.]\d{1,2})?$/.test(amount) &&
      (/^km$/i.test(symbol) || (/^«m$/i.test(symbol) && /[,.]/.test(amount)))) {
      const value = Number(amount.replace(',', '.'))
      if (value > 0) values.distance = String(value)
    }
  }

  const [clock, clockSuffix] = preceding(elapsed)
  const time = clock?.text.match(/^(\d{1,3}):([0-5]\d)(?::([0-5]\d))?$/)
  if (time && !clockSuffix?.text.startsWith('/')) {
    const seconds = Number(time[1]) * 3600 + Number(time[2]) * 60 + Number(time[3] ?? 0)
    if (seconds >= 60) values.elapsed = fullMinutes(seconds) ?? undefined
  }

  const [height, heightUnit] = preceding(ascent)
  if (ascent && reliable(ascent[1]) && height) {
    const meters = height.text.match(/^(\d{1,5})m$/i)
    if (meters) values.ascent = String(Number(meters[1]))
    else if (/^\d{1,5}$/.test(height.text) && heightUnit && reliable(heightUnit) &&
      /^m$/i.test(heightUnit.text) && heightUnit.x - height.x <= 7 * ascent[0].height) {
      values.ascent = String(Number(height.text))
    }
  }

  const titleLines = lines.filter(line => line[0].y < heading.y && aligned(line[0], heading))
  const last = titleLines.at(-1)
  if (notes && last && reliable(heading) && heading.y - last[0].y <= 3 * last[0].height) {
    const previous = titleLines.at(-2)
    const wrapped = previous && last[0].y - previous[0].y <= 2 * previous[0].height
    const title = (wrapped ? [previous, last] : [last]).map(line => {
      const words: string[] = []
      for (const [index, word] of line.entries()) {
        const prior = line[index - 1]
        if (prior && word.x - prior.x - prior.width > 2 * line[0].height) break
        if (!reliable(word) || !/^[\p{L}][\p{L}'’-]*$/u.test(word.text)) return ''
        words.push(word.text)
      }
      return words.join(' ')
    })
    if (title.every(Boolean) && title.join(' ').length <= 120) values.title = title.join(' ')
  }

  return values
}
