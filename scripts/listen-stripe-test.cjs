const { loadEnvConfig } = require('@next/env')
const { spawn } = require('node:child_process')
const { existsSync } = require('node:fs')
const path = require('node:path')
process.chdir(path.resolve(__dirname, '..'))
loadEnvConfig(process.cwd())
if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') || process.env.SHOP_PAYMENT_MODE !== 'test') {
  console.error('Bitte zuerst den Stripe-Testschlüssel einrichten.'); process.exit(1)
}
const binary = '/private/tmp/ultimate-stripe-cli/stripe'
if (!existsSync(binary)) { console.error('Das lokale Stripe-Hilfsprogramm muss erneut eingerichtet werden. Bitte im Chat Bescheid geben.'); process.exit(1) }
const child = spawn(binary, ['listen', '--events', 'checkout.session.completed,checkout.session.async_payment_succeeded', '--forward-to', 'http://localhost:3000/api/shop/stripe/webhook'], {
  env: { ...process.env, STRIPE_API_KEY: process.env.STRIPE_SECRET_KEY }, stdio: ['ignore', 'pipe', 'pipe'],
})
const redact = data => process.stdout.write(data.toString().replace(/(?:whsec_|sk_test_)[A-Za-z0-9_]+/g, '[geschützt]'))
child.stdout.on('data', redact); child.stderr.on('data', redact)
child.on('error', () => console.error('Stripe-Testweiterleitung konnte nicht gestartet werden.'))
child.on('exit', code => { process.exitCode = code || 0 })
process.on('SIGINT', () => child.kill('SIGINT'))
console.log('Leitet ausschließlich Stripe-Testbestätigungen an localhost:3000 weiter. Dieses Terminal offen lassen.')
