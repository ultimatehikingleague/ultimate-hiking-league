import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Encoder, Profile, Utils } from '@garmin/fitsdk'
import { eligibility, fullMinutes } from '../app/lib/activity/normalize'
import { maxActivityBytes, parseActivity } from '../app/lib/activity/parse'

const xml = (source: string) => new TextEncoder().encode(source)

test('duration always discards seconds, including fractional device durations', () => {
  for (const [seconds, expected] of [
    [17_475, '04:51'], [17_519, '04:51'], [17_999, '04:59'], [18_000, '05:00'],
    [59.999, '00:00'], [60, '00:01'], [90_000, '25:00'],
  ] as const) assert.equal(fullMinutes(seconds), expected)
  assert.equal(fullMinutes(null), null)
  assert.equal(fullMinutes(-1), null)
  assert.equal(fullMinutes(Infinity), null)
})

test('eligibility is advisory and unknown ascent remains unknown', () => {
  assert.equal(eligibility(7, 1000), 'regular')
  assert.equal(eligibility(10, null), 'regular')
  assert.equal(eligibility(9.99, 600), 'regular')
  assert.equal(eligibility(9.99, 599), 'exception')
  assert.equal(eligibility(7, null), 'unknown')
})

test('GPX uses elapsed time and only measures distance within segments', () => {
  const parsed = parseActivity(xml(`<gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Testwanderung</name>
  <trkseg><trkpt lat="47" lon="11"><time>2026-10-10T10:00:00Z</time></trkpt>
  <trkpt lat="47.001" lon="11"><time>2026-10-10T11:00:00Z</time></trkpt></trkseg>
  <trkseg><trkpt lat="48" lon="12"><time>2026-10-10T14:51:59Z</time></trkpt></trkseg>
  </trk></gpx>`), 'test.gpx')
  assert.equal(parsed.name, 'Testwanderung')
  assert.equal(parsed.elapsedSeconds, 17_519)
  assert.equal(parsed.elapsed, '04:51')
  assert.equal(parsed.moving, null)
  assert.equal(parsed.ascent, null)
  assert.equal(parsed.pointCount, 3)
  assert.ok(parsed.distanceKm! > 0.11 && parsed.distanceKm! < 0.12)
})

test('TCX preserves device distance and does not infer moving time from timestamps', () => {
  const parsed = parseActivity(xml(`<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities>
  <Activity Sport="Other"><Id>2026-10-10T10:00:00Z</Id><Lap StartTime="2026-10-10T10:00:00Z"><DistanceMeters>7000</DistanceMeters>
  <Track><Trackpoint><Time>2026-10-10T14:59:59Z</Time></Trackpoint></Track></Lap></Activity>
  </Activities></TrainingCenterDatabase>`), 'test.tcx')
  assert.equal(parsed.elapsed, '04:59')
  assert.equal(parsed.distanceKm, 7)
  assert.equal(parsed.eligibility, 'unknown')
  assert.equal(parsed.moving, null)
})

test('FIT verifies integrity and preserves positive ascent', () => {
  const encoder = new Encoder()
  const start = (Date.parse('2026-10-10T10:00:00Z') - Utils.FIT_EPOCH_MS) / 1000
  const fileId = { mesgNum: Profile.MesgNum.FILE_ID, type: 'activity', manufacturer: 'development', timeCreated: start }
  const session = { mesgNum: Profile.MesgNum.SESSION, startTime: start, timestamp: start + 17_475,
    sport: 'hiking', totalDistance: 7000, totalElapsedTime: 17_475, totalMovingTime: 14_499, totalAscent: 1032, totalDescent: 400 }
  encoder.writeMesg(fileId)
  encoder.writeMesg(session)
  const bytes = new Uint8Array(encoder.close())
  const parsed = parseActivity(bytes, 'test.fit')
  assert.equal(parsed.elapsed, '04:51')
  assert.equal(parsed.moving, '04:01')
  assert.equal(parsed.ascent, 1032)
  assert.equal(parsed.eligibility, 'regular')
  bytes[bytes.length - 1] ^= 255
  assert.throws(() => parseActivity(bytes, 'test.fit'), /beschädigt/)
})

test('missing time and GPS jumps are flagged without inventing a distance', () => {
  const parsed = parseActivity(xml('<gpx><trk><trkseg><trkpt lat="47" lon="11"/><trkpt lat="48" lon="12"/></trkseg></trk></gpx>'), 'test.gpx')
  assert.equal(parsed.elapsed, null)
  assert.equal(parsed.distanceKm, null)
  assert.ok(parsed.warnings.some(warning => warning.includes('GPS-Sprünge')))
})

test('rejects malformed XML, external declarations, unsupported formats and oversized uploads', () => {
  assert.throws(() => parseActivity(xml('<gpx><trk></gpx>'), 'test.gpx'))
  assert.throws(() => parseActivity(xml('<!DOCTYPE gpx SYSTEM "file:///tmp/test"><gpx/>'), 'test.gpx'), /Dokumenttypen/)
  assert.throws(() => parseActivity(xml('test'), 'test.pdf'), /GPX, FIT oder TCX/)
  assert.throws(() => parseActivity(new Uint8Array(maxActivityBytes + 1), 'test.gpx'), /4 MB/)
})

test('comparison uses submitted edits and normalized duration', async () => {
  const { compareActivity, activityDateInBerlin } = await import('../app/lib/activity/compare')
  const activity = parseActivity(xml(`<gpx><trk><trkseg>
    <trkpt lat="47" lon="11"><time>2026-10-10T22:30:00Z</time></trkpt>
    <trkpt lat="47.001" lon="11"><time>2026-10-11T03:21:59Z</time></trkpt>
    </trkseg></trk></gpx>`), 'test.gpx')
  const submission = {
    activity_date: '2026-10-11', distance_km: activity.distanceKm,
    actual_distance_km: 7, elapsed_time_text: '04:51:15', elevation_gain: 700,
  }
  assert.equal(activityDateInBerlin(activity.start), '2026-10-11')
  assert.deepEqual(compareActivity(activity, submission).map(row => row.result), ['match', 'different', 'match', 'uncertain'])
  assert.equal(compareActivity(activity, { ...submission, elapsed_time_text: '04:52' })[2].result, 'different')
  assert.equal(compareActivity(activity, { ...submission, elapsed_time_text: null })[2].result, 'missing')
})

test('GPX estimates ascent and descent separately per segment from a smoothed profile', () => {
  const segment = (heights: (number | null)[]) => '<trkseg>' + heights.map((height, index) =>
    `<trkpt lat="${47 + index * 0.0001}" lon="11">${height === null ? '' : `<ele>${height}</ele>`}</trkpt>`
  ).join('') + '</trkseg>'
  const read = (...segments: (number | null)[][]) =>
    parseActivity(xml('<gpx><trk>' + segments.map(segment).join('') + '</trk></gpx>'), 'test.gpx')

  const parsed = read([100, 102, 110, 125, 130, 125, 110, 105, 100], [500, 501, 500, 501, 500])
  assert.deepEqual([parsed.ascent, parsed.descent, parsed.ascentSource], [25, 25, 'profile'])
  assert.equal(read([100, 101, 100, 101, 100]).ascent, 0)
  assert.equal(read([100, 102, null, 125, 130]).ascent, null)
  assert.equal(read([100, 102, 500, 125, 130]).ascent, null)
})

test('rounds imported distance for display while keeping the precise value for unchanged input', async () => {
  const { formatActivityDistanceInput, readActivityDistanceInput } = await import('../app/lib/activity/normalize')
  const precise = 13.617548109765863
  assert.equal(formatActivityDistanceInput(precise), '13.62')
  assert.equal(readActivityDistanceInput('13,62', precise), precise)
  assert.equal(readActivityDistanceInput('14,2', precise), 14.2)
  assert.equal(readActivityDistanceInput('13.615', null), 13.615)
  assert.equal(fullMinutes(19_950), '05:32')
})
