import type { Metadata } from 'next'
import { clientScope } from '../../../i18n/client-scope'

export const metadata: Metadata = { robots: { index: false, follow: false } }
export default clientScope('milestones', 'partnerBenefits')
