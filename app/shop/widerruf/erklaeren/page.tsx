import { useTranslations } from 'next-intl'
import WithdrawalForm from './WithdrawalForm'
export default function Page(){
  const t = useTranslations('withdrawalStart')
  return <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100"><div className="mx-auto max-w-2xl"><h1 className="text-3xl font-bold">{t('title')}</h1><p className="mt-4 text-stone-300">{t('intro')}</p><WithdrawalForm/></div></main>}
