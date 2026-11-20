import { notFound } from 'next/navigation'
import { PrototypeLayout } from '@/i18n/prototype/public-layout'
import { spanishEnabled, wave1Enabled } from '@/i18n/wave1'
import type { ReactNode } from 'react'

export default function Layout({ children }: { children: ReactNode }) {
  if (!wave1Enabled || !spanishEnabled) notFound()
  return <PrototypeLayout locale="es">{children}</PrototypeLayout>
}
