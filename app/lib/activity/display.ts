import { fullMinutes, normalizeActivityDurationText } from './normalize'

const distance = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const elevation = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 })

export function formatDistanceKm(value: number | null | undefined, useGrouping = true) {
  if (value == null || !Number.isFinite(value)) return null
  return useGrouping ? distance.format(value) : distance.format(value).replaceAll('.', '')
}

export function formatElevationMeters(value: number | null | undefined, useGrouping = true) {
  if (value == null || !Number.isFinite(value)) return null
  return useGrouping ? elevation.format(value) : elevation.format(value).replaceAll('.', '')
}

export function formatElapsedTime(text: string | null | undefined, hours?: number | null) {
  return normalizeActivityDurationText(text ?? null) ?? fullMinutes(hours == null ? null : hours * 3600)
}
