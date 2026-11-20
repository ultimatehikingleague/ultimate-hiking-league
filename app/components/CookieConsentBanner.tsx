'use client'

import { useTranslations } from 'next-intl'
import Link from '@/i18n/prototype/LocalizedLink'
import { useEffect, useState } from 'react'

const CONSENT_KEY = 'uhl_cookie_consent'

type ConsentValue = 'accepted_all' | 'necessary_only' | null

export default function CookieConsentBanner() {
  const t = useTranslations('ui')
  const [consent, setConsent] = useState<ConsentValue>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const savedConsent = window.localStorage.getItem(CONSENT_KEY) as ConsentValue
    setConsent(savedConsent ?? null)
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    if (!consent) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [mounted, consent])

  function saveConsent(value: Exclude<ConsentValue, null>) {
    window.localStorage.setItem(CONSENT_KEY, value)
    window.dispatchEvent(new Event('uhl-consent-updated'))
    setConsent(value)
    }

  if (!mounted || consent) {
    return null
  }

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.72)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          zIndex: 9998,
        }}
      />

      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '40px 16px 24px',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '760px',
            background: '#181716',
            color: '#ffffff',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '30px',
            padding: '28px',
            boxShadow: '0 30px 100px rgba(0,0,0,0.65)',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color: '#a8a29e',
            }}
          >{t("privacy")}</div>

          <h2
            style={{
              marginTop: '14px',
              fontSize: 'clamp(30px, 5vw, 46px)',
              lineHeight: 1.05,
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >{t("privacyHeading")}</h2>

          <p
            style={{
              marginTop: '18px',
              fontSize: '16px',
              lineHeight: 1.7,
              color: '#e7e5e4',
            }}
          >{t("cookieIntroduction")}</p>

          <p
            style={{
              marginTop: '12px',
              fontSize: '15px',
              lineHeight: 1.7,
              color: '#d6d3d1',
            }}
          >{t("cookieChoice")}</p>

          <div
            style={{
              marginTop: '24px',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '20px',
              background: 'rgba(0,0,0,0.20)',
              padding: '18px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '16px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#ffffff',
                  }}
                >{t("essentialTech")}</div>
                <div
                  style={{
                    marginTop: '6px',
                    fontSize: '14px',
                    lineHeight: 1.6,
                    color: '#a8a29e',
                  }}
                >{t("essentialDescription")}</div>
              </div>

              <div
                style={{
                  flexShrink: 0,
                  borderRadius: '999px',
                  border: '1px solid rgba(52,211,153,0.20)',
                  background: 'rgba(52,211,153,0.10)',
                  color: '#bbf7d0',
                  padding: '7px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >{t("alwaysActive")}</div>
            </div>
          </div>

          <div
            style={{
              marginTop: '14px',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '20px',
              background: 'rgba(0,0,0,0.20)',
              padding: '18px',
            }}
          >
            <div
              style={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#ffffff',
              }}
            >{t("analytics")}</div>
            <div
              style={{
                marginTop: '6px',
                fontSize: '14px',
                lineHeight: 1.6,
                color: '#a8a29e',
              }}
            >{t("analyticsDescription")}</div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '12px',
              marginTop: '28px',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={() => saveConsent('necessary_only')}
              style={{
                flex: '1 1 220px',
                minHeight: '54px',
                borderRadius: '18px',
                border: '1px solid rgba(255,255,255,0.10)',
                background: 'transparent',
                color: '#e7e5e4',
                fontSize: '15px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >{t("essentialOnly")}</button>

            <button
              type="button"
              onClick={() => saveConsent('accepted_all')}
              style={{
                flex: '1 1 220px',
                minHeight: '54px',
                borderRadius: '18px',
                border: 'none',
                background: '#f5f5f4',
                color: '#111827',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >{t("acceptAll")}</button>
          </div>

          <p
            style={{
              marginTop: '18px',
              fontSize: '13px',
              lineHeight: 1.7,
              color: '#78716c',
            }}
          >{t("privacyInfo")}{' '}
            <Link
              href="/datenschutz"
              style={{
                color: '#d6d3d1',
                textDecoration: 'underline',
                textUnderlineOffset: '3px',
              }}
            >{t("privacyPolicy")}</Link>
            .
          </p>
        </div>
      </div>
    </>
  )
}