import { PrototypeLayout } from '@/i18n/prototype/public-layout'
import type { ReactNode } from 'react'

export default function Layout({ children }: { children: ReactNode }) {
  return <PrototypeLayout locale="en">{children}</PrototypeLayout>
}
