import { notFound } from 'next/navigation'
import { wave1Enabled } from './wave1'

export function requireWave1() {
  if (!wave1Enabled) notFound()
}
