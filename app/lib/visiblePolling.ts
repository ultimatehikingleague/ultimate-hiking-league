type Events = {
  addEventListener(type: string, callback: () => void): void
  removeEventListener(type: string, callback: () => void): void
}
type Page = Events & { visibilityState: string }
type Clock = Events & {
  setInterval(callback: () => void, milliseconds: number): number
  clearInterval(id: number): void
}

// Each mounted consumer keeps its own auth context. No shared cache or session state.
export function startVisiblePolling(
  refresh: () => Promise<void>,
  page: Page = document,
  clock: Clock = window,
) {
  let stopped = false
  let pending = false
  const run = async () => {
    if (stopped || pending || page.visibilityState !== 'visible') return
    pending = true
    try { await refresh() } finally { pending = false }
  }
  const onActive = () => { void run() }
  onActive()
  const timer = clock.setInterval(onActive, 30000)
  page.addEventListener('visibilitychange', onActive)
  clock.addEventListener('focus', onActive)
  return () => {
    stopped = true
    clock.clearInterval(timer)
    page.removeEventListener('visibilitychange', onActive)
    clock.removeEventListener('focus', onActive)
  }
}
