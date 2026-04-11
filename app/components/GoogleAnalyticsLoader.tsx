'use client'

import { useEffect } from 'react'

const CONSENT_KEY = 'uhl_cookie_consent'
const GA_ID = 'G-M0ST1NQTGQ'

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag?: (...args: unknown[]) => void
    __uhlGaInitialized?: boolean
  }
}

export default function GoogleAnalyticsLoader() {
  useEffect(() => {
    function initAnalytics() {
      const consent = window.localStorage.getItem(CONSENT_KEY)

      if (consent !== 'accepted_all') {
        return
      }

      if (window.__uhlGaInitialized) {
        return
      }

      const existingScript = document.querySelector(
        `script[src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"]`
      )

      if (!existingScript) {
        const script = document.createElement('script')
        script.async = true
        script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
        document.head.appendChild(script)
      }

      window.dataLayer = window.dataLayer || []

      function gtag() {
        window.dataLayer.push(arguments)
      }

      window.gtag = gtag
      window.gtag('js', new Date())
      window.gtag('config', GA_ID)

      window.__uhlGaInitialized = true
    }

    initAnalytics()

    function handleConsentUpdated() {
      initAnalytics()
    }

    window.addEventListener('uhl-consent-updated', handleConsentUpdated)

    return () => {
      window.removeEventListener('uhl-consent-updated', handleConsentUpdated)
    }
  }, [])

  return null
}