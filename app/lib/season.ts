const berlinYear = new Intl.DateTimeFormat('en', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
})

export const FIRST_SEASON_YEAR = 2026
export const SEASON_RANKINGS_START = 2027

export function getSeasonYear(now = new Date()) {
  return Number(berlinYear.format(now))
}

export function nextSeasonStart(year: number) {
  return Date.parse(`${year + 1}-01-01T00:00:00+01:00`)
}
