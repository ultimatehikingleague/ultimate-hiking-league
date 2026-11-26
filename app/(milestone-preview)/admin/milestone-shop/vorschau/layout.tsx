import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import LegacyLayout from '@/app/legacy-layout'
import { clientScope } from '@/i18n/client-scope'

export const metadata: Metadata = { robots: { index: false, follow: false } }

const ShopMessages = clientScope('milestones', 'partnerBenefits')

export default function PreviewLayout({ children }: { children: ReactNode }) {
  return <LegacyLayout admin><ShopMessages>{children}</ShopMessages></LegacyLayout>
}
