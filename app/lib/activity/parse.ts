import { Decoder, Stream } from '@garmin/fitsdk'
import { SaxesParser } from 'saxes'
import { estimateElevation } from './elevation'
import { eligibility, fullMinutes } from './normalize'

export const maxActivityBytes = 4 * 1024 * 1024
type Point = { lat?: number; lon?: number; time?: number; elevation?: number; segment: number }
type Summary = {
  garminElapsedSeconds?: number
  name?: string; sport?: string; start?: number; end?: number; elapsed?: number
  moving?: number; distance?: number; ascent?: number; descent?: number; speed?: number
}
const numeric = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined
const positive = (value: unknown) => { const n = numeric(value); return n !== undefined && n >= 0 ? n : undefined }
const xmlNumber = (value: string | undefined) => value?.trim() ? numeric(Number(value)) : undefined
const timestamp = (value: unknown) => value instanceof Date ? numeric(value.getTime())
  : typeof value === 'string' && /(?:Z|[+-]\d\d:\d\d)$/i.test(value) ? numeric(Date.parse(value)) : undefined

function readXml(bytes: Uint8Array, format: 'gpx' | 'tcx') {
  const parser = new SaxesParser({ xmlns: true })
  const stack: string[] = []
  const points: Point[] = []
  const summary: Summary = {}
  let segment = 0
  let activityCount = 0
  let point: Point | undefined
  let value = ''
  let lapDistance = 0
  let laps = 0
  let distanceLaps = 0
  parser.on('doctype', () => { throw Error('XML-Dokumenttypen sind nicht erlaubt.') })
  parser.on('opentag', tag => {
    const name = tag.local
    stack.push(name)
    if (stack.length > 40) throw Error('XML ist zu tief verschachtelt.')
    if (stack.length === 1 && name !== (format === 'gpx' ? 'gpx' : 'TrainingCenterDatabase')) throw Error('Dateiinhalt passt nicht zum Format.')
    value = ''
    if ((format === 'gpx' && name === 'trk') || (format === 'tcx' && name === 'Activity')) {
      if (++activityCount > 1) throw Error('Bitte eine einzelne Aktivität exportieren.')
      summary.sport = tag.attributes.Sport?.value
    }
    if (name === 'trkseg' || name === 'Track') segment++
    if (name === 'Lap') {
      laps++
      summary.start ??= timestamp(tag.attributes.StartTime?.value)
    }
    if (name === 'trkpt' || name === 'Trackpoint') {
      point = { segment, lat: xmlNumber(tag.attributes.lat?.value), lon: xmlNumber(tag.attributes.lon?.value) }
    }
  })
  parser.on('text', chunk => { if (value.length < 4096) value += chunk.slice(0, 4096 - value.length) })
  parser.on('closetag', tag => {
    const name = tag.local
    const parent = stack.at(-2)
    const content = value.trim()
    if (point) {
      if ((parent === 'trkpt' && name === 'ele') || (parent === 'Trackpoint' && name === 'AltitudeMeters')) point.elevation = xmlNumber(content)
      if (name === 'time' || name === 'Time') point.time = timestamp(content)
      if (name === 'LatitudeDegrees') point.lat = xmlNumber(content)
      if (name === 'LongitudeDegrees') point.lon = xmlNumber(content)
      if (name === 'trkpt' || name === 'Trackpoint') {
        if (points.length >= 100_000) throw Error('Die Aufzeichnung enthält zu viele Punkte.')
        points.push(point)
        point = undefined
      }
    } else if (parent === 'Lap' && name === 'DistanceMeters') {
      const meters = positive(xmlNumber(content))
      if (meters !== undefined) { lapDistance += meters; distanceLaps++ }
    } else if (parent === 'trk' && name === 'name') summary.name = content.slice(0, 120)
    else if (parent === 'trk' && name === 'type') summary.sport = content.slice(0, 60)
    else if (parent === 'Activity' && name === 'Id') summary.start ??= timestamp(content)
    stack.pop()
    value = ''
  })
  parser.write(new TextDecoder('utf-8', { fatal: true }).decode(bytes)).close()
  if (!activityCount || (!points.length && !distanceLaps)) throw Error('Die Datei enthält keine auswertbare Aktivität.')
  if (laps && laps === distanceLaps) summary.distance = lapDistance
  return { summary, points }
}

function readFit(bytes: Uint8Array) {
  const decoder = new Decoder(Stream.fromByteArray(bytes))
  if (!decoder.checkIntegrity()) throw Error('FIT-Datei ist beschädigt.')
  const { messages, errors } = decoder.read({ mergeHeartRates: false, decodeMemoGlobs: false })
  const sessions = messages.sessionMesgs ?? []
  if (errors.length || sessions.length !== 1) throw Error('FIT-Datei muss eine lesbare Einzelaktivität enthalten.')
  const session = sessions[0]
  const fileId = messages.fileIdMesgs?.[0]
  const elapsed = positive(session.totalElapsedTime)
  const timer = positive(session.totalTimerTime)
  const garminElapsedSeconds = fileId?.type === 'activity' && fileId.manufacturer === 'garmin' &&
    (session.sport === 'hiking' || session.sport === 'walking') &&
    timestamp(session.startTime) !== undefined && elapsed !== undefined &&
    timer !== undefined && timer > 0 && timer <= elapsed ? elapsed : undefined
  const summary: Summary = {
    start: timestamp(session.startTime), end: timestamp(session.timestamp),
    garminElapsedSeconds, elapsed, moving: positive(session.totalMovingTime),
    distance: positive(session.totalDistance), ascent: positive(session.totalAscent),
    descent: positive(session.totalDescent),
    speed: positive(session.enhancedAvgSpeed ?? session.avgSpeed),
    sport: typeof session.sport === 'string' ? session.sport : undefined,
  }
  const points = (messages.recordMesgs ?? []).map(record => ({
    segment: 0, time: timestamp(record.timestamp),
    elevation: numeric(record.enhancedAltitude ?? record.altitude),
    lat: numeric(record.positionLat) === undefined ? undefined : Number(record.positionLat) * 180 / 2 ** 31,
    lon: numeric(record.positionLong) === undefined ? undefined : Number(record.positionLong) * 180 / 2 ** 31,
  }))
  return { summary, points }
}

const radians = Math.PI / 180
function validCoordinates(point: Point): point is Point & { lat: number; lon: number } {
  return point.lat !== undefined && point.lon !== undefined && Math.abs(point.lat) <= 90 && Math.abs(point.lon) <= 180
}

export function parseActivity(bytes: Uint8Array, filename: string, byteLimit = maxActivityBytes) {
  if (!bytes.length || bytes.length > byteLimit) throw Error(`Die Datei muss zwischen 1 Byte und ${byteLimit / 1024 / 1024} MB groß sein.`)
  const format = filename.split('.').pop()?.toLowerCase()
  if (format !== 'gpx' && format !== 'tcx' && format !== 'fit') throw Error('Bitte GPX, FIT oder TCX auswählen.')
  const { summary, points } = format === 'fit' ? readFit(bytes) : readXml(bytes, format)
  const warnings = new Set<string>()
  let meters = 0
  let hasMeasuredSegments = false
  let unreliableGps = false
  let nonChronological = false
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1]
    const current = points[index]
    if (previous.segment !== current.segment) continue
    const seconds = previous.time === undefined || current.time === undefined ? undefined : (current.time - previous.time) / 1000
    if (seconds !== undefined && seconds < 0) nonChronological = true
    if (!validCoordinates(previous) || !validCoordinates(current)) continue
    const a = Math.sin((current.lat - previous.lat) * radians / 2) ** 2 +
      Math.cos(previous.lat * radians) * Math.cos(current.lat * radians) *
      Math.sin((current.lon - previous.lon) * radians / 2) ** 2
    const segmentMeters = 12_742_000 * Math.asin(Math.sqrt(Math.min(1, a)))
    if (segmentMeters >= 1000 || (seconds !== undefined && segmentMeters > 25 && (seconds <= 0 || segmentMeters / seconds > 12))) {
      unreliableGps = true
      continue
    }
    meters += segmentMeters
    hasMeasuredSegments = true
  }
  if (unreliableGps) warnings.add('Auffällige GPS-Sprünge oder Geschwindigkeiten.')
  if (nonChronological) warnings.add('Zeitstempel sind nicht durchgehend chronologisch.')
  const start = summary.start ?? points[0]?.time
  const end = summary.end ?? points.at(-1)?.time
  const elapsed = summary.elapsed ?? (!nonChronological && start !== undefined && end !== undefined && end > start ? (end - start) / 1000 : undefined)
  if (elapsed === undefined) warnings.add('Keine verlässliche Gesamtzeit erkannt.')
  const distance = summary.distance ?? (hasMeasuredSegments && !unreliableGps ? meters : undefined)
  if (distance === undefined) warnings.add('Keine verlässliche Distanz erkannt.')
  const profile = !unreliableGps && !nonChronological && (summary.ascent === undefined || summary.descent === undefined)
    ? estimateElevation(points) : undefined
  if (summary.ascent === undefined && profile === undefined) warnings.add('Kein belastbarer Aufstiegswert erkannt.')
  if (points.length && points.some(point => !validCoordinates(point))) warnings.add('GPS-Aufzeichnung enthält Punkte ohne gültige Koordinaten.')
  const distanceKm = distance === undefined ? null : distance / 1000
  const ascent = summary.ascent ?? profile?.ascent ?? null
  return {
    format, name: summary.name ?? null, sport: summary.sport ?? null,
    start: start === undefined ? null : new Date(start).toISOString(),
    end: end === undefined ? null : new Date(end).toISOString(),
    garminElapsedSeconds: summary.garminElapsedSeconds ?? null,
    elapsedSeconds: elapsed ?? null, elapsed: fullMinutes(elapsed ?? null),
    moving: fullMinutes(summary.moving ?? null), distanceKm,
    distanceSource: summary.distance !== undefined ? 'device' : distance !== undefined ? 'gps' : null,
    ascent, descent: summary.descent ?? profile?.descent ?? null,
    ascentSource: summary.ascent !== undefined ? 'device' : profile ? 'profile' : null,
    descentSource: summary.descent !== undefined ? 'device' : profile ? 'profile' : null,
    averageSpeed: summary.speed !== undefined ? summary.speed * 3.6 : null,
    pointCount: points.filter(validCoordinates).length,
    eligibility: eligibility(distanceKm, ascent), warnings: [...warnings],
  }
}
