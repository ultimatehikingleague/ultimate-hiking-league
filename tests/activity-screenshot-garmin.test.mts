import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { createWorker } from 'tesseract.js'
import { recognizeGarminScreenshots } from '../app/lib/activity/garmin-ocr'

const fixtures = process.env.UHL_GARMIN_OCR_FIXTURES
const market = process.env.UHL_GARMIN_MARKT_SCREENSHOT
const models = process.env.UHL_OCR_MODELS

test('recognizes Garmin overview statistics from both original PNG screenshots', {
  skip: !fixtures || !models ? 'Set UHL_GARMIN_OCR_FIXTURES and UHL_OCR_MODELS to local directories' : false,
}, async () => {
  assert.ok(fixtures && models)
  const worker = await createWorker(['deu', 'eng'], 1, { langPath: models, cacheMethod: 'none' })
  try {
    await worker.setParameters({ preserve_interword_spaces: '1' })
    for (const [file, values] of [
      ['IMG_4017.PNG', { distance: '11.18', elapsed: '04:53', ascent: '447', title: 'Grainau Wandern' }],
      ['IMG_3978.PNG', { distance: '11.53', elapsed: '05:07', ascent: '531', title: 'Garmisch-Partenkirchen Wandern' }],
    ] as const) {
      for (let run = 0; run < 2; run++) {
        assert.deepEqual(await recognizeGarminScreenshots(worker, [join(fixtures, file)]), { values, conflicts: [] }, file)
      }
    }
  } finally {
    await worker.terminate()
  }
})

test('recognizes Markt Erlbach twice through the same OCR pipeline', {
  skip: !market || !models ? 'Set UHL_GARMIN_MARKT_SCREENSHOT and UHL_OCR_MODELS' : false,
}, async () => {
  assert.ok(market && models)
  const worker = await createWorker(['deu', 'eng'], 1, { langPath: models, cacheMethod: 'none' })
  try {
    await worker.setParameters({ preserve_interword_spaces: '1' })
    for (let run = 0; run < 2; run++) {
      const { values, conflicts } = await recognizeGarminScreenshots(worker, [market])
      assert.deepEqual([values.distance, values.elapsed, values.ascent], ['17.5', '04:14', '289'])
      assert.deepEqual(conflicts, [])
    }
  } finally {
    await worker.terminate()
  }
})
