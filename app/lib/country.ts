export const COUNTRY_MAP: Record<string, string> = {
  de: 'DE',
  deutschland: 'DE',
  germany: 'DE',

  at: 'AT',
  österreich: 'AT',
  oesterreich: 'AT',
  austria: 'AT',

  ch: 'CH',
  schweiz: 'CH',
  switzerland: 'CH',
  suisse: 'CH',
  svizzera: 'CH',

  dk: 'DK',
  dänemark: 'DK',
  daenemark: 'DK',
  denmark: 'DK',

  be: 'BE',
  belgien: 'BE',
  belgium: 'BE',

  nl: 'NL',
  niederlande: 'NL',
  holland: 'NL',
  netherlands: 'NL',

  lu: 'LU',
  luxemburg: 'LU',
  luxembourg: 'LU',

  fr: 'FR',
  frankreich: 'FR',
  france: 'FR',

  es: 'ES',
  spanien: 'ES',
  spain: 'ES',

  pt: 'PT',
  portugal: 'PT',

  it: 'IT',
  italien: 'IT',
  italy: 'IT',

  gb: 'GB',
  uk: 'GB',
  england: 'GB',
  'united kingdom': 'GB',
  großbritannien: 'GB',
  grossbritannien: 'GB',

  ie: 'IE',
  irland: 'IE',
  ireland: 'IE',

  no: 'NO',
  norwegen: 'NO',
  norway: 'NO',

  se: 'SE',
  schweden: 'SE',
  sweden: 'SE',

  fi: 'FI',
  finnland: 'FI',
  finland: 'FI',

  is: 'IS',
  island: 'IS',
  iceland: 'IS',

  pl: 'PL',
  polen: 'PL',
  poland: 'PL',

  cz: 'CZ',
  tschechien: 'CZ',
  czechia: 'CZ',
  'czech republic': 'CZ',

  sk: 'SK',
  slowakei: 'SK',
  slovakia: 'SK',

  hu: 'HU',
  ungarn: 'HU',
  hungary: 'HU',

  si: 'SI',
  slowenien: 'SI',
  slovenia: 'SI',

  hr: 'HR',
  kroatien: 'HR',
  croatia: 'HR',

  ba: 'BA',
  bosnien: 'BA',
  bosnia: 'BA',
  'bosnia and herzegovina': 'BA',

  rs: 'RS',
  serbien: 'RS',
  serbia: 'RS',

  me: 'ME',
  montenegro: 'ME',

  xk: 'XK',
  kosovo: 'XK',

  al: 'AL',
  albanien: 'AL',
  albania: 'AL',

  mk: 'MK',
  nordmazedonien: 'MK',
  northmacedonia: 'MK',
  'north macedonia': 'MK',

  gr: 'GR',
  griechenland: 'GR',
  greece: 'GR',

  ro: 'RO',
  rumänien: 'RO',
  rumaenien: 'RO',
  romania: 'RO',

  bg: 'BG',
  bulgarien: 'BG',
  bulgaria: 'BG',

  md: 'MD',
  moldau: 'MD',
  moldova: 'MD',

  ua: 'UA',
  ukraine: 'UA',

  by: 'BY',
  belarus: 'BY',
  weißrussland: 'BY',
  weissrussland: 'BY',

  lt: 'LT',
  litauen: 'LT',
  lithuania: 'LT',

  lv: 'LV',
  lettland: 'LV',
  latvia: 'LV',

  ee: 'EE',
  estland: 'EE',
  estonia: 'EE',

  ru: 'RU',
  russland: 'RU',
  russia: 'RU',

  tr: 'TR',
  türkei: 'TR',
  tuerkei: 'TR',
  turkey: 'TR',

  mt: 'MT',
  malta: 'MT',

  cy: 'CY',
  zypern: 'CY',
  cyprus: 'CY',

  ad: 'AD',
  andorra: 'AD',

  mc: 'MC',
  monaco: 'MC',

  sm: 'SM',
  'san marino': 'SM',

  va: 'VA',
  vatikan: 'VA',
  vatican: 'VA',

  li: 'LI',
  liechtenstein: 'LI',
}

export function normalizeCountryCode(input: string | null | undefined) {
  const value = (input ?? '').trim().toLowerCase()

  if (!value) return ''

  return COUNTRY_MAP[value] ?? (value.length === 2 ? value.toUpperCase() : '')
}

export function countryToFlag(country: string | null | undefined) {
  const code = normalizeCountryCode(country)

  if (code.length !== 2) return '—'

  return String.fromCodePoint(
    ...[...code].map((char) => 127397 + char.charCodeAt(0))
  )
}