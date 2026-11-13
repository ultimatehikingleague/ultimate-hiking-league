'use client'
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { startVisiblePolling } from './visiblePolling'

// One database switch controls routes, profile visibility and redemption.
export function useMilestoneLaunch() {
  const [live, setLive] = useState(false)
  useEffect(() => {
    let cancelled = false
    async function refresh() {
      try {
        const { data, error } = await supabase.rpc('milestone_shop_is_live')
        if (!cancelled) setLive(!error && data === true)
      } catch {
        if (!cancelled) setLive(false)
      }
    }
    const stop = startVisiblePolling(refresh)
    return () => { cancelled = true; stop() }
  }, [])
  return live
}
