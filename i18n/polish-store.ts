const calendarAlt: Record<string, string> = {
  'cover-final.webp': 'Okładka kalendarza Schorschy’s Wanderkalender 2027',
  'month-1-final.webp': 'Kalendarz Schorschy’s Wanderkalender, styczeń 2027',
  'month-8-final.webp': 'Kalendarz Schorschy’s Wanderkalender, sierpień 2027',
  'month-12-final.webp': 'Kalendarz Schorschy’s Wanderkalender, grudzień 2027',
}

const italianCalendarAlt: Record<string, string> = {
  'cover-final.webp': 'Copertina di Schorschy’s Wanderkalender 2027',
  'month-1-final.webp': 'Schorschy’s Wanderkalender, gennaio 2027',
  'month-8-final.webp': 'Schorschy’s Wanderkalender, agosto 2027',
  'month-12-final.webp': 'Schorschy’s Wanderkalender, dicembre 2027',
}

const spanishCalendarAlt: Record<string, string> = {
  'cover-final.webp': 'Portada de Schorschy’s Wanderkalender 2027',
  'month-1-final.webp': 'Schorschy’s Wanderkalender, enero de 2027',
  'month-8-final.webp': 'Schorschy’s Wanderkalender, agosto de 2027',
  'month-12-final.webp': 'Schorschy’s Wanderkalender, diciembre de 2027',
}

const czechCalendarAlt: Record<string, string> = {
  'cover-final.webp': 'Obálka kalendáře Schorschy’s Wanderkalender 2027',
  'month-1-final.webp': 'Schorschy’s Wanderkalender, leden 2027',
  'month-8-final.webp': 'Schorschy’s Wanderkalender, srpen 2027',
  'month-12-final.webp': 'Schorschy’s Wanderkalender, prosinec 2027',
}

export function calendarImageAlt(locale: string, image: { src: string; alt: string }) {
  const file = image.src.split('/').at(-1) ?? ''
  if (locale === 'cs') return czechCalendarAlt[file] ?? image.alt
  if (locale === 'es') return spanishCalendarAlt[file] ?? image.alt
  if (locale === 'it') return italianCalendarAlt[file] ?? image.alt
  return locale === 'pl' ? calendarAlt[file] ?? image.alt : image.alt
}

export function storeTagline(locale: string) {
  if (locale === 'cs') return 'Pro vaše výpravy.'
  if (locale === 'es') return 'Para tus aventuras.'
  if (locale === 'it') return 'Per le tue avventure.'
  return locale === 'pl' ? 'Na Twoją wyprawę.' : 'Made for your journey.'
}
