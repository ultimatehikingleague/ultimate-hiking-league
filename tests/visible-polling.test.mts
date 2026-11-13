import test from 'node:test'
import assert from 'node:assert/strict'
import { startVisiblePolling } from '../app/lib/visiblePolling'

test('poll only visible pages, coalesce in-flight refreshes, refresh on return and clean up', async () => {
  const listeners = new Map<string, () => void>()
  const events = {
    addEventListener: (name: string, fn: () => void) => { listeners.set(name, fn) },
    removeEventListener: (name: string) => { listeners.delete(name) },
  }
  const page = { ...events, visibilityState: 'hidden' }
  let tick = () => {}; let cleared = false; let calls = 0; let resolve = () => {}
  const clock = { ...events, setInterval: (fn: () => void, ms: number) => { assert.equal(ms,30000); tick=fn; return 7 }, clearInterval: (id: number) => { assert.equal(id,7); cleared=true } }
  const stop = startVisiblePolling(() => { calls++; return new Promise<void>(done => { resolve=done }) }, page, clock)
  tick(); assert.equal(calls,0)
  page.visibilityState='visible'; listeners.get('visibilitychange')!(); listeners.get('focus')!(); tick()
  assert.equal(calls,1)
  resolve(); await Promise.resolve(); tick(); assert.equal(calls,2)
  resolve(); await Promise.resolve(); page.visibilityState='hidden'; tick(); assert.equal(calls,2)
  page.visibilityState='visible'; listeners.get('focus')!(); assert.equal(calls,3)
  stop(); resolve(); await Promise.resolve(); tick(); assert.equal(calls,3)
  assert.equal(cleared,true); assert.equal(listeners.size,0)
})
