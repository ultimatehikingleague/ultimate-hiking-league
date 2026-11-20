export type PartnerPackageType = 'event_partner' | 'brand_partner'
export type PackageTermDays = 7 | 30 | 90 | 365

export type PartnerPackage = {
  code: string
  name: string
  label: string
  services: string
  offers: readonly { days: PackageTermDays; cents: number }[]
}

export const PARTNER_PACKAGES: Record<PartnerPackageType, readonly PartnerPackage[]> = {
  brand_partner: [
    { code: 'A', name: 'Banner Basic', label: 'A - Banner Basic', services: 'Klickbarer statischer oder animierter Banner in der Startseitenmitte auf Desktop und Mobil.', offers: [{ days: 7, cents: 4900 }, { days: 30, cents: 9900 }, { days: 90, cents: 24900 }] },
    { code: 'B', name: 'Ranking Banner', label: 'B - Ranking Banner', services: 'Klickbarer statischer oder animierter Banner in Ranglisten und Divisionen auf Desktop und Mobil.', offers: [{ days: 7, cents: 6900 }, { days: 30, cents: 14900 }, { days: 90, cents: 37900 }] },
    { code: 'C', name: 'Öffentliche Profile', label: 'C - Öffentliche Profile', services: 'Klickbarer statischer oder animierter Banner auf öffentlichen Athletenprofilen auf Desktop und Mobil.', offers: [{ days: 7, cents: 8900 }, { days: 30, cents: 19900 }, { days: 90, cents: 49900 }] },
    { code: 'D', name: 'Persönlicher Nutzerbereich', label: 'D - Persönlicher Nutzerbereich', services: 'Klickbarer statischer oder animierter Banner im eingeloggten Mitgliederbereich auf Desktop und Mobil.', offers: [{ days: 7, cents: 9900 }, { days: 30, cents: 22900 }, { days: 90, cents: 57900 }] },
    { code: 'E', name: 'Premium Homepage Slot', label: 'E - Premium Homepage Slot', services: 'Klickbarer statischer oder animierter Banner im oberen sichtbaren Startseitenbereich auf Desktop und Mobil. Maximal drei Premium-Homepage-Slots gleichzeitig.', offers: [{ days: 7, cents: 12900 }, { days: 30, cents: 29900 }, { days: 90, cents: 74900 }] },
    { code: 'F', name: 'Official Partner', label: 'F - Official Partner', services: 'Partnerstatus, Footerlogo und klickbarer statischer oder animierter Homepage-Banner auf Desktop und Mobil. Social-Erwähnung und bevorzugte Platzierungen.', offers: [{ days: 365, cents: 349900 }] },
    { code: 'M', name: 'Milestone-Partner', label: 'Milestone-Partner · Footer-Präsenz', services: 'Logo mit Partnerlink oberhalb des Footers im gebuchten Zeitraum.', offers: [] },
  ],
  event_partner: [
    { code: 'A', name: 'Event Basic', label: 'A - Event Basic', services: 'Logo im Eventkasten, hervorgehobene Darstellung, Priorisierung im Eventbereich und Wunschbeschreibung.', offers: [{ days: 7, cents: 3900 }, { days: 30, cents: 7900 }, { days: 90, cents: 19900 }] },
    { code: 'B', name: 'Event Boost', label: 'B - Event Boost', services: 'Leistungen von Event Basic plus Platzierung im sichtbaren Startseitenbereich.', offers: [{ days: 7, cents: 6900 }, { days: 30, cents: 14900 }, { days: 90, cents: 37900 }] },
    { code: 'C', name: 'Serien Partner', label: 'C - Serien Partner', services: 'Bis zu fünf Events gleichzeitig mit den Leistungen von Event Basic und Event Boost. Startseitenrotation sowie bevorzugte Einsendung und Betreuung.', offers: [{ days: 30, cents: 29900 }, { days: 90, cents: 79900 }, { days: 365, cents: 249000 }] },
    { code: 'D', name: 'Main Event Partner', label: 'D - Main Event Partner', services: 'Exklusive Main-Event-Partnerschaft. Bis zu 15 Events pro Vertragsjahr mit den Leistungen von Event Basic und Event Boost. Startseiten-Premium-Slot, Badge als offizieller Eventpartner und bevorzugte Betreuung.', offers: [{ days: 365, cents: 499000 }] },
  ],
}

export function getPartnerPackages(type: PartnerPackageType) {
  return PARTNER_PACKAGES[type]
}

export function getPartnerPackageName(type: PartnerPackageType, code: string) {
  return getPartnerPackages(type).find((item) => item.code === code)?.name ?? code
}

export function getDurationOptions(type: PartnerPackageType, code: string) {
  return getPartnerPackages(type).find((item) => item.code === code)?.offers.map((offer) => offer.days) ?? [7]
}

export function packageEndDate(startDate: string, days: string) {
  if (!startDate || !days) return ''

  const date = new Date(`${startDate}T00:00:00Z`)
  if (days === '365') {
    const day = date.getUTCDate()
    date.setUTCDate(1)
    date.setUTCFullYear(date.getUTCFullYear() + 1)
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
    date.setUTCDate(Math.min(day, lastDay) - 1)
  } else {
    date.setUTCDate(date.getUTCDate() + Number(days) - 1)
  }

  return date.toISOString().slice(0, 10)
}
