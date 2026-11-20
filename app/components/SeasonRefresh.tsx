'use client'

import { useEffect } from 'react'
import { getSeasonYear, nextSeasonStart } from '../lib/season'

export default function SeasonRefresh({ year }: { year?: number }) {
  useEffect(() => {
    const displayedYear = year ?? getSeasonYear()
    let timer: ReturnType<typeof setTimeout>

    function checkYear() {
      clearTimeout(timer)
      if (getSeasonYear() !== displayedYear) {
        window.location.reload()
        return
      }
      timer = setTimeout(checkYear, Math.min(
        60 * 60 * 1000,
        Math.max(1, nextSeasonStart(displayedYear) - Date.now()),
      ))
    }

    checkYear()
    window.addEventListener('pageshow', checkYear)
    document.addEventListener('visibilitychange', checkYear)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('pageshow', checkYear)
      document.removeEventListener('visibilitychange', checkYear)
    }
  }, [year])
  return null
}
