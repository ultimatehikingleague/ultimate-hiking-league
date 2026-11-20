import { normalizeActivityDurationText } from './normalize'

export function formatDistanceKm(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatElevationMeters(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value).toLocaleString('de-DE')
}

export function formatElapsedTime(value: string | null | undefined): string | null {
  return normalizeActivityDurationText(value ?? null)
}
