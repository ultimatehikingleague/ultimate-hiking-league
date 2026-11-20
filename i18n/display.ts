export function formatRankingDistance(value: number | null | undefined, locale: string) {
  if (value == null || !Number.isFinite(value)) return null
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}
