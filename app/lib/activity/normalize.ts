export function fullMinutes(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return null
  const minutes = Math.floor(seconds / 60)
  return [Math.floor(minutes / 60), minutes % 60].map(value => String(value).padStart(2, '0')).join(':')
}

export function eligibility(distance: number | null, ascent: number | null) {
  if ((distance !== null && distance >= 10) || (ascent !== null && ascent >= 600)) return 'regular'
  if (distance === null || ascent === null) return 'unknown'
  return 'exception'
}

export function normalizeActivityDurationText(value: string | null) {
  const parts = value?.trim().match(/^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/)
  if (!parts) return null
  return fullMinutes(Number(parts[1]) * 3600 + Number(parts[2]) * 60 + Number(parts[3] ?? 0))
}

export function formatActivityDistanceInput(distance: number | null) {
  return distance === null ? '' : String(Number(distance.toFixed(2)))
}

export function readActivityDistanceInput(input: string, importedDistance: number | null) {
  const normalized = input.trim().replace(',', '.')
  return importedDistance !== null && normalized === formatActivityDistanceInput(importedDistance)
    ? importedDistance
    : Number(normalized)
}
