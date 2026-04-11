'use client'

import { useEffect } from 'react'

const CONSENT_KEY = 'uhl_cookie_consent'
const GA_ID = 'G-M0ST1NQTGQ'

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export default function GoogleAnalyticsLoader() {
  useEffect(() => {
    const consent = window.localStorage.getItem(CONSENT_KEY)

    if (consent !== 'accepted_all') {
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

    if (!window.dataLayer) {
      window.dataLayer = []
    }

    function gtag(...args: unknown[]) {
      window.dataLayer.push(args)
    }

    window.gtag = gtag
    window.gtag('js', new Date())
    window.gtag('config', GA_ID)

  }, [])

  return null
}