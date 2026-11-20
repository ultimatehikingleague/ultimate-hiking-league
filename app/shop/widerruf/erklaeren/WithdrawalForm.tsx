'use client'
import { useLocale, useTranslations } from 'next-intl'
import { isWave1Locale } from '@/i18n/wave1'
import { useState, type FormEvent } from 'react'
export default function WithdrawalForm(){
  const t = useTranslations('withdrawalForm')
  const locale = useLocale()
 const [details,setDetails]=useState<{name:string;email:string;contractReference:string}|null>(null),[receipt,setReceipt]=useState<{id:string;receivedAt:string}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 function review(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);setDetails({name:String(f.get('name')).trim(),email:String(f.get('email')).trim(),contractReference:String(f.get('reference')).trim()})}
 async function submit() {
  if (!details || busy) return
  setBusy(true)
  setError('')
  try {
    let id = sessionStorage.getItem('ultimate-withdrawal-id')
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem('ultimate-withdrawal-id', id)
    }
    const response = await fetch('/api/shop/withdrawal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...details, id }),
    })
    const result = await response.json()
    if (!response.ok) {
      setError(locale === 'de' && result.error ? result.error : t('failed'))
      return
    }
    setReceipt(result)
    sessionStorage.removeItem('ultimate-withdrawal-id')
  } catch (error) {
    setError(locale === 'de' && error instanceof Error ? error.message : t('retry'))
  } finally {
    setBusy(false)
  }
 }
 const field='mt-2 block w-full rounded-lg border border-white/20 bg-white/5 p-3'
 if (receipt && details) {
  const localized = isWave1Locale(locale)
  const date = new Intl.DateTimeFormat(localized ? locale : 'de-DE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).format(new Date(receipt.receivedAt))
  const text = localized ? t('receiptText', { id: receipt.id, date, name: details.name, email: details.email, reference: details.contractReference }) : `Eingangsbestätigung Ihres Widerrufs\nPhilipp Dobrinski / ULTIMATE\nReferenz: ${receipt.id}\nEingang: ${new Date(receipt.receivedAt).toLocaleString('de-DE',{timeZone:'Europe/Berlin'})} (Europe/Berlin)\nName: ${details.name}\nE-Mail: ${details.email}\nWiderrufener Vertrag/Vertragsteil: ${details.contractReference}\nHiermit widerrufe ich den oben bezeichneten Vertrag/Vertragsteil.\n`
  const filename = localized ? t('receiptFilename') : 'Widerrufs-Eingangsbestätigung.txt'
  const displayedDate = localized ? date : new Date(receipt.receivedAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })
  return (
    <div className="mt-8 rounded-xl border border-emerald-400/30 p-6">
      <h2 className="text-xl font-semibold">{t('received')}</h2>
      <p className="mt-4">{t('receivedAt')} {displayedDate} {t('timeZone')}</p>
      <p className="mt-3">{t('emailSent')}</p>
      <a className="mt-5 inline-block rounded-lg bg-emerald-800 px-4 py-3" download={filename}
        href={'data:text/plain;charset=utf-8,' + encodeURIComponent(text)}>{t('download')}</a>
    </div>
  )
 }
 return <div className="mt-7">{details?<section className="rounded-xl border border-white/20 p-6"><h2 className="text-xl font-semibold">{t('review')}</h2><dl className="mt-5 space-y-4"><div><dt>{t('name')}</dt><dd>{details.name}</dd></div><div><dt>{t('email')}</dt><dd>{details.email}</dd></div><div><dt>{t('reference')}</dt><dd className="whitespace-pre-wrap break-words">{details.contractReference}</dd></div></dl><p className="mt-6">{t('confirmNotice')}</p><button disabled={busy} onClick={submit} className="mt-5 rounded-lg bg-emerald-800 px-5 py-3 font-semibold">{busy?t('busy'):t('confirm')}</button><button disabled={busy} onClick={()=>{sessionStorage.removeItem('ultimate-withdrawal-id');setDetails(null);setError('')}} className="ml-5 underline">{t('edit')}</button></section>:<form onSubmit={review} className="space-y-5"><label className="block">{t('fullName')}<input required name="name" maxLength={120} autoComplete="name" className={field}/></label><label className="block">{t('email')}<input required name="email" type="email" maxLength={254} autoComplete="email" className={field}/></label><label className="block">{t('contractDetails')}<textarea required name="reference" maxLength={2000} rows={4} className={field}/><span className="mt-2 block text-sm text-stone-400">{t('help')}</span></label><button className="rounded-lg bg-emerald-800 px-5 py-3 font-semibold">{t('review')}</button></form>}{error&&<p role="alert" className="mt-4 text-red-300">{error}</p>}<p className="mt-6 text-sm text-stone-400">{t('alternative')} <a href="/datenschutz" className="underline">{t('privacy')}</a></p></div>
}
