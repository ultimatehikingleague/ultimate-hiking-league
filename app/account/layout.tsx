import LegacyLayout from '../legacy-layout'
import ScopedLayout from './scoped-layout'
import type { ReactNode } from 'react'

export { generateMetadata } from '../legacy-layout'
export default function Layout({ children }: { children: ReactNode }) {
  return <LegacyLayout><ScopedLayout>{children}</ScopedLayout></LegacyLayout>
}
