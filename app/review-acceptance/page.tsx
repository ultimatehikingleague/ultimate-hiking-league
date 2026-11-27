import { notFound } from 'next/navigation'
import Acceptance from './Acceptance'

export default function ReviewAcceptancePage() {
  if (process.env.NODE_ENV !== 'development' || process.env.UHL_REVIEW_ACCEPTANCE !== '1') notFound()
  return <Acceptance />
}
