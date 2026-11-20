import { useTranslations } from 'next-intl'
import Link from '@/i18n/prototype/LocalizedLink'
export default function WithdrawalPage(){
  const t = useTranslations('withdrawal')
  return <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100"><div className="mx-auto max-w-3xl"><Link href="/shop" className="text-emerald-300">{t('back')}</Link><h1 className="mt-7 text-3xl font-bold">{t('title')}</h1><Link href="/shop/widerruf/erklaeren" className="my-7 inline-flex rounded-lg bg-emerald-800 px-5 py-3 font-semibold">{t('start')}</Link><div className="whitespace-pre-line text-sm leading-7 text-stone-300">{t('body')}</div></div></main>}
