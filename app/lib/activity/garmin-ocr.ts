import { PSM, type Worker } from 'tesseract.js'
import { readGarminScreenshot } from './garmin-screenshot'
import { readScreenshotValues } from './screenshot'

export async function recognizeGarminScreenshots(
  worker: Worker,
  images: Parameters<Worker['recognize']>[0][],
) {
  const scans: { text: string; tsv: string | null }[] = []
  const output = { text: false, tsv: true }
  for (const image of images) {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO })
    const { data } = await worker.recognize(image, {}, output)
    const first = data.tsv ? readGarminScreenshot(data.tsv) : null
    if (first) scans.push({ text: '', tsv: data.tsv })
    if (first?.distance && first.elapsed && first.ascent) continue

    // A second segmentation can recover labels split by the overview columns.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT })
    const retry = await worker.recognize(image, {}, output)
    if (retry.data.tsv && readGarminScreenshot(retry.data.tsv)) {
      scans.push({ text: '', tsv: retry.data.tsv })
    }
  }
  return readScreenshotValues(scans)
}
