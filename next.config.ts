import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'
import { publishedLanguages } from './i18n/language-register'
import { wave1Enabled, wave1Languages, wave1ReleaseBuild } from './i18n/wave1'

const productionBuild = process.env.VERCEL_ENV === 'production'
if (productionBuild && !wave1ReleaseBuild) {
  throw new Error('Building the FR/NL production release requires explicit release configuration.')
}

if (wave1Enabled) {
  const backend = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://unconfigured.invalid')
  const localBackend = ['localhost', '127.0.0.1', '[::1]'].includes(backend.hostname)
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      (productionBuild ? localBackend || backend.protocol !== 'https:' || backend.hostname === 'unconfigured.invalid' :
        !localBackend || process.env.NEXT_PUBLIC_ACTIVITY_IMPORT_ENABLED !== 'true')) {
    throw new Error(productionBuild ? 'FR/NL production build requires the existing HTTPS Supabase configuration.' :
      'FR/NL preview requires a loopback Supabase fixture.')
  }
}

const routedLanguages = wave1Enabled ? [...publishedLanguages, ...wave1Languages] : publishedLanguages
const nextConfig: NextConfig = {
  async headers() {
    return wave1Enabled && !wave1ReleaseBuild ? [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }] : []
  },
  async rewrites() {
    return { beforeFiles: [{ source: `/:locale(${routedLanguages.join('|')})/:slug((?!rules$|faq$|search$|skyscraper$|events$|leaderboard$|division$|impressum$|datenschutz$|disclaimer$|kontakt$|cookie-einstellungen$|shop$|[1-9][0-9]*$)[^/]+)`, destination: '/language-route-unavailable/not-found' }], afterFiles: [], fallback: [] }
  },
}
export default createNextIntlPlugin()(nextConfig)
