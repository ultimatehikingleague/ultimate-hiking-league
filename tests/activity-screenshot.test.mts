import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readScreenshotValues, screenshotProofPrefix, screenshotProofUrls } from '../app/lib/activity/screenshot'

test('reads Outdooractive-style statistics and keeps elapsed and moving time separate', () => {
  const { values } = readScreenshotValues([
    'Garmin | Wiesenttal Wandern\n25.04.2026\nGesamtdistanz   14,20 km\nAufstieg 590 hm\nAbstieg 587 hm',
    'Start 25.04.2026 09:03\nAufgezeichnete Zeit (inkl. manueller & automatischer Pausen) 5:33 h\nZeit in Bewegung 2:48 h',
  ])
  assert.deepEqual(values, {
    title: 'Garmin | Wiesenttal Wandern', date: '2026-04-25', distance: '14.2',
    ascent: '590', descent: '587', elapsed: '05:33', moving: '02:48',
  })
})

test('leaves unlabeled durations and conflicting distances open', () => {
  const { values, conflicts } = readScreenshotValues([
    'Dauer 5:33 h\nZeit in Bewegung 2:48 h\nDistanz 14,20 km\nStrecke bergauf 5 km',
    'Distanz 13,62 km\nDatum 31.02.2026',
  ])
  assert.deepEqual(values, { moving: '02:48' })
  assert.deepEqual(conflicts, ['distance'])
  assert.equal(readScreenshotValues(['Gesamtzeit 04:59:59']).values.elapsed, '04:59')
})

test('multiple proof references resolve to individual existing proof bucket links', () => {
  const first = 'http://127.0.0.1:54321/storage/v1/object/public/record-proofs/record-1/first.png'
  const second = first.replace('first.png', 'second.png')
  assert.deepEqual(screenshotProofUrls(screenshotProofPrefix + JSON.stringify([first, second])), [first, second])
  assert.deepEqual(screenshotProofUrls(screenshotProofPrefix + '["javascript:alert(1)"]'), [])
})

test('does not extract a distance from the seconds or minutes of adjacent pace', () => {
  for (const pace of ['4:53:18          26:12 km @', '5:07:30          26:40 km @', '26:40 /km']) {
    assert.deepEqual(readScreenshotValues([`Distanz\n${pace}\nGesamtzeit     Ø Pace\n24. Juni @ 09:12`]).values, {})
  }
})

test('private proof references accept only paths owned by the submission user', async () => {
  const { privateScreenshotPaths, privateScreenshotPrefix, isScreenshotImage } = await import('../app/lib/activity/screenshot-proof')
  const owner = '10000000-0000-0000-0000-000000000001'
  const other = '10000000-0000-0000-0000-000000000002'
  const path = `${owner}/${other}/0.png`
  assert.deepEqual(privateScreenshotPaths(privateScreenshotPrefix + path, owner), [path])
  assert.deepEqual(privateScreenshotPaths(privateScreenshotPrefix + path, other), [])
  assert.deepEqual(privateScreenshotPaths(privateScreenshotPrefix + owner + '/../0.png', owner), [])
  assert.equal(await isScreenshotImage(new File(['invalid'], 'file.png', { type: 'image/png' })), false)
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  assert.equal(await isScreenshotImage(new File([signature], 'file.png', { type: 'image/png' })), true)
})
