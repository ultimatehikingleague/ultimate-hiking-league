import { PrototypeLayout } from '@/i18n/prototype/public-layout'
import { PilotLayout } from '@/i18n/pilot-view'
import { wave1Enabled } from '@/i18n/wave1'
import type { ReactNode } from 'react'

export default function Layout({ children }: { children: ReactNode }) {
  if (wave1Enabled) return <PrototypeLayout locale="nl">{children}</PrototypeLayout>
  return <PilotLayout preference={{ locale: 'nl', manual: false, explicit: true }}>{children}</PilotLayout>
}
