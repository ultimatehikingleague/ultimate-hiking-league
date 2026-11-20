type Sample = Record<string, unknown>

function seconds(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function coordinate(value: unknown, limit: number) {
  return typeof value === 'number' && Math.abs(value) <= limit ? value : null
}

const radians = Math.PI / 180

// Retain only the outcome. Coordinates and individual timestamps are discarded.
export function checkGarminSamples(samples: unknown, start: number | null, elapsed: number | null) {
  if (!Array.isArray(samples) || samples.length === 0) return 'samples-missing'

  let incomplete = samples.length < 2
  let firstClock: number | null = null
  let lastClock: number | null = null
  let lastTime: number | null = null
  let lastTimer: number | null = null
  let lastMoving: number | null = null
  let previousGps: { lat: number; lon: number; time: number } | null = null

  for (const entry of samples) {
    const sample = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry as Sample : {}
    const time = seconds(sample.startTimeInSeconds)
    const clock = seconds(sample.clockDurationInSeconds)
    const timer = seconds(sample.timerDurationInSeconds)
    const moving = seconds(sample.movingDurationInSeconds)
    if ((sample.startTimeInSeconds != null && time === null) ||
        (sample.clockDurationInSeconds != null && clock === null) ||
        (sample.timerDurationInSeconds != null && timer === null) ||
        (sample.movingDurationInSeconds != null && moving === null) ||
        (clock !== null && lastClock !== null && clock < lastClock) ||
        (time !== null && lastTime !== null && time < lastTime) ||
        (timer !== null && ((clock !== null && timer > clock) || (lastTimer !== null && timer < lastTimer))) ||
        (moving !== null && ((clock !== null && moving > clock) || (timer !== null && moving > timer) ||
          (lastMoving !== null && moving < lastMoving))) ||
        (time !== null && start !== null && (time < start || (elapsed !== null && time > start + elapsed + 1) ||
          (clock !== null && Math.abs(time - start - clock) > 1)))) return 'sample-time-inconsistent'

    firstClock ??= clock
    lastClock = clock ?? lastClock
    lastTime = time ?? lastTime
    lastTimer = timer ?? lastTimer
    lastMoving = moving ?? lastMoving

    const lat = coordinate(sample.latitudeInDegree, 90)
    const lon = coordinate(sample.longitudeInDegree, 180)
    if ((sample.latitudeInDegree != null && lat === null) ||
        (sample.longitudeInDegree != null && lon === null)) return 'sample-coordinates-invalid'
    if (time === null || clock === null || lat === null || lon === null) incomplete = true
    if (time === null || lat === null || lon === null) continue
    if (previousGps) {
      const a = Math.sin((lat - previousGps.lat) * radians / 2) ** 2 +
        Math.cos(lat * radians) * Math.cos(previousGps.lat * radians) *
        Math.sin((lon - previousGps.lon) * radians / 2) ** 2
      const meters = 12_742_000 * Math.asin(Math.sqrt(Math.min(1, a)))
      const delta = time - previousGps.time
      // Match the existing parser's GPS outlier thresholds, including its jitter allowance.
      if (meters >= 1000 || (meters > 25 && (delta <= 0 || meters / delta > 12))) return 'sample-gps-jump'
    }
    previousGps = { lat, lon, time }
  }

  return incomplete || elapsed === null || firstClock === null || firstClock > 1
    ? 'samples-incomplete' : 'samples-consistent'
}
