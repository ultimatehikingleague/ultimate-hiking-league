import { setRequestLocale } from 'next-intl/server'
import type { ReactNode } from 'react'
import RootLayout, { legacyMetadata } from '../legacy-layout'

export const metadata = legacyMetadata

export default function AdminLayout({ children }: { children: ReactNode }) {
  setRequestLocale('de')
  return <RootLayout admin>{children}</RootLayout>
}
