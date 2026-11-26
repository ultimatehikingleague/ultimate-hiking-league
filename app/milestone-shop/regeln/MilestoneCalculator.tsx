'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRef, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import styles from './rules.module.css'

export default function MilestoneCalculator() {
  const t = useTranslations('milestoneRules')
  const locale = useLocale()
  const [distance, setDistance] = useState('')
  const [status, setStatus] = useState<'invalidDistance' | 'calculationUnavailable' | 'calculating' | null>(null)
  const [points, setPoints] = useState<number | null>(null)
  const request = useRef(0)

  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const version = ++request.current
    const value = distance.trim()
    setPoints(null)

    if (!/^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(value)) {
      setStatus('invalidDistance')
      return
    }

    setStatus('calculating')
    try {
      const { data, error } = await supabase.rpc('calculate_reward_points', { p_distance_km: value.replace(',', '.') })
      if (version !== request.current) return
      if (error || typeof data !== 'number' || !Number.isSafeInteger(data) || data < 0) {
        setStatus('calculationUnavailable')
        return
      }

      setPoints(data)
      setStatus(null)
    } catch {
      if (version === request.current) setStatus('calculationUnavailable')
    }
  }

  return (
    <form className={styles.calculator} onSubmit={calculate} aria-labelledby="milestone-rechner">
      <h3 id="milestone-rechner">{t('calculator')}</h3>
      <p>{t('calculatorIntro')}</p>
      <label htmlFor="milestone-distance">{t('distanceInput')}</label>
      <div className={styles.calculatorControls}>
        <input id="milestone-distance" inputMode="decimal" maxLength={24} value={distance}
          aria-invalid={status === 'invalidDistance' || undefined} aria-describedby="milestone-distance-hint"
          onChange={event => {
            request.current++
            setDistance(event.target.value)
            setStatus(null)
            setPoints(null)
          }} />
        <button type="submit" className="milestone-button" disabled={status === 'calculating'}>{t('calculate')}</button>
      </div>
      <p id="milestone-distance-hint">{t('distanceHint')}</p>
      <output htmlFor="milestone-distance" className={styles.result} aria-live="polite" aria-atomic="true">
        {points !== null ? t('calculationResult', { points: new Intl.NumberFormat(locale).format(points) }) : status && t(status)}
      </output>
    </form>
  )
}
