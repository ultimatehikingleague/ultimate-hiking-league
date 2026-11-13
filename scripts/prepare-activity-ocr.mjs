import { copyFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const target = join(process.argv[2] ?? 'public', 'activity-ocr')
mkdirSync(target, { recursive: true })
const modules = fileURLToPath(new URL('../node_modules/', import.meta.url))
const assets = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ...['deu', 'eng'].map(lang => [`@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`, `${lang}.traineddata.gz`]),
]
for (const [source, filename] of assets) copyFileSync(join(modules, source), join(target, filename))
