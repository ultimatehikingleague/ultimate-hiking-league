export type GarminRecordAttribution = { device_model: string } | { device_model: string }[] | null

export function garminAttribution(record: {
  garmin_verified: boolean | null
  garmin_record_attributions: GarminRecordAttribution
}) {
  if (!record.garmin_verified) return null
  const attribution = record.garmin_record_attributions
  const model = (Array.isArray(attribution) ? attribution[0] : attribution)?.device_model.trim()
  return model && !/^Garmin\b/i.test(model) ? `Garmin ${model}` : model || 'Garmin'
}
