// Display adapters for the existing API text fields. Activity data and responses stay unchanged.
export const garminIssueKeys = new Map<string, keyof typeof import('../messages/en.json')['garminDisplay']>([
  [
    "Diese Wanderung erreicht weder 10 km noch 600 positive Höhenmeter.",
    "belowMinimum"
  ],
  [
    "Manuell erstellte oder hochgeladene Aktivitäten sind von der Direktveröffentlichung ausgeschlossen.",
    "manualUpload"
  ],
  [
    "Garmin hat keine Distanz übermittelt.",
    "missingDistance"
  ],
  [
    "Garmin hat keinen Aufstieg übermittelt.",
    "missingAscent"
  ],
  [
    "Garmin hat keine Gesamtzeit übermittelt.",
    "missingElapsed"
  ],
  [
    "Garmin hat die Aktivität nicht als Wanderung erfasst.",
    "notHiking"
  ],
  [
    "Die Durchschnittsgeschwindigkeit liegt über 15 km/h.",
    "speedLimit"
  ],
  [
    "Der Aufstieg liegt über 2.000 Höhenmetern pro Stunde.",
    "ascentLimit"
  ],
  [
    "Die aufgezeichneten Garmin-Streckendaten sind unplausibel.",
    "implausibleTrack"
  ],
  [
    "Garmin hat die Aktivität noch nicht vollständig bestätigt.",
    "unconfirmed"
  ],
  [
    "Die Garmin-Zustellungen enthalten widersprüchliche Angaben.",
    "conflictingData"
  ],
  [
    "Die Garmin-Daten reichen für die automatische Prüfung nicht aus.",
    "insufficientData"
  ]
])

export const activityWarningKeys = new Map<string, keyof typeof import('../messages/en.json')['activityPreview']>([
  [
    "Auffällige GPS-Sprünge oder Geschwindigkeiten.",
    "gpsJumps"
  ],
  [
    "Zeitstempel sind nicht durchgehend chronologisch.",
    "timestampOrder"
  ],
  [
    "Keine verlässliche Gesamtzeit erkannt.",
    "unknownElapsed"
  ],
  [
    "Keine verlässliche Distanz erkannt.",
    "unknownDistance"
  ],
  [
    "Kein belastbarer Aufstiegswert erkannt.",
    "unknownAscent"
  ],
  [
    "GPS-Aufzeichnung enthält Punkte ohne gültige Koordinaten.",
    "invalidCoordinates"
  ]
])
