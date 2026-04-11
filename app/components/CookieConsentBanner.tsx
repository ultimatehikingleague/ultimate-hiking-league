'use client'

import { useEffect, useState } from 'react'

const CONSENT_KEY = 'uhl_cookie_consent'

type ConsentValue = 'accepted_all' | 'necessary_only' | null

export default function CookieConsentBanner() {
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
          >
            Datenschutz
          </div>

          <h2
            style={{
              marginTop: '14px',
              fontSize: 'clamp(30px, 5vw, 46px)',
              lineHeight: 1.05,
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            Deine Privatsphäre ist uns wichtig.
          </h2>

          <p
            style={{
              marginTop: '18px',
              fontSize: '16px',
              lineHeight: 1.7,
              color: '#e7e5e4',
            }}
          >
            Wir verwenden notwendige Technologien für den Betrieb der Website.
            Mit deiner Zustimmung nutzen wir zusätzlich Statistik, um Ultimate
            Hiking League zu analysieren und zu verbessern.
          </p>

          <p
            style={{
              marginTop: '12px',
              fontSize: '15px',
              lineHeight: 1.7,
              color: '#d6d3d1',
            }}
          >
            Bitte triff jetzt eine Auswahl. Deine Entscheidung kannst du später
            jederzeit wieder ändern.
          </p>

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
                >
                  Notwendige Technologien
                </div>
                <div
                  style={{
                    marginTop: '6px',
                    fontSize: '14px',
                    lineHeight: 1.6,
                    color: '#a8a29e',
                  }}
                >
                  Erforderlich für Grundfunktionen der Website und immer aktiv.
                </div>
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
              >
                Immer aktiv
              </div>
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
            >
              Statistik
            </div>
            <div
              style={{
                marginTop: '6px',
                fontSize: '14px',
                lineHeight: 1.6,
                color: '#a8a29e',
              }}
            >
              Hilft uns zu verstehen, wie die Plattform genutzt wird und wo wir
              sie verbessern können.
            </div>
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
            >
              Nur notwendige
            </button>

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
            >
              Alle akzeptieren
            </button>
          </div>

          <p
            style={{
              marginTop: '18px',
              fontSize: '13px',
              lineHeight: 1.7,
              color: '#78716c',
            }}
          >
            Mehr Informationen findest du in unserer{' '}
            <a
              href="/datenschutz"
              style={{
                color: '#d6d3d1',
                textDecoration: 'underline',
                textUnderlineOffset: '3px',
              }}
            >
              Datenschutzerklärung
            </a>
            .
          </p>
        </div>
      </div>
    </>
  )
}