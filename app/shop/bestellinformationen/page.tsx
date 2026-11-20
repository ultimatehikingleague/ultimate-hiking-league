import { useTranslations } from 'next-intl'
import Link from '@/i18n/prototype/LocalizedLink'
export default function PurchasePage(){
  const t = useTranslations('purchase')
  return <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100"><div className="mx-auto max-w-3xl"><Link href="/shop" className="text-emerald-300">{t('back')}</Link><h1 className="my-7 text-3xl font-bold">{t('title')}</h1><div className="whitespace-pre-line text-sm leading-7 text-stone-300">{t('body')}</div><Link href="/shop/widerruf" className="mt-7 inline-block text-emerald-300 underline">{t('withdrawal')}</Link></div></main>}
