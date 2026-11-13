import { loadEnvConfig } from '@next/env'
import { processNextTestFulfillment } from '../app/lib/shop/fulfillment'
loadEnvConfig(process.cwd())
async function main() {
  if (process.env.SHOP_PAYMENT_MODE !== 'test' || process.env.SHOP_LIVE_APPROVED === 'true') throw new Error('This worker only runs in test mode with live sales locked')
  const watch = process.argv.includes('--watch')
  console.log('Gelato-Testautomatik: nur Entwürfe, keine Produktion. Strg+C beendet die Verarbeitung.')
  do {
    const result = await processNextTestFulfillment()
    if (result) console.log(JSON.stringify(result))
    if (watch) await new Promise(resolve => setTimeout(resolve, 10000))
  } while (watch)
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Worker failed'); process.exitCode = 1 })
