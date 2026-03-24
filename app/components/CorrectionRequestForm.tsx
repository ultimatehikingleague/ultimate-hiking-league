type CorrectionRequestFormProps = {
  recordId?: number | string
  hikerId?: number | string
  currentDistance?: number | null
  currentDistanceKm?: number | null
  currentTimeText?: string | null
  currentElapsedTime?: string | null
  verificationType?: string | null
  onSubmitted?: () => void
  [key: string]: unknown
}

export default function CorrectionRequestForm(
  _props: CorrectionRequestFormProps
) {
  return null
}