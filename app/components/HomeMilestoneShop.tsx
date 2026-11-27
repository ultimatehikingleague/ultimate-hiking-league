'use client'

import Image from 'next/image'
import { X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useId, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { authLanguageHint } from '@/i18n/auth-language'

export default function HomeMilestoneShop() {
  const t = useTranslations('homeMilestoneShop')
  const locale = useLocale()
  const dialog = useRef<HTMLDialogElement>(null)
  const checking = useRef(false)
  const [pending, setPending] = useState(false)
  const titleId = useId()
  const descriptionId = useId()

  async function openShop() {
    if (checking.current) return
    checking.current = true
    setPending(true)
    try {
      const { data, error } = await supabase.rpc('milestone_shop_is_live')
        .abortSignal(AbortSignal.timeout(5000))
      if (!error && data === true) {
        window.location.assign('/milestone-shop?' + new URLSearchParams({ [authLanguageHint]: locale }))
        return
      }
    } catch {
      // The shop stays closed when its global status is unavailable.
    } finally {
      checking.current = false
      setPending(false)
    }
    dialog.current?.showModal()
  }

  return (
    <>
      <button
        type="button"
        onClick={openShop}
        aria-busy={pending}
        className="group inline-flex min-w-0 flex-col items-center rounded-full px-3 pb-3 outline-offset-4 transition-transform duration-300 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-cyan-300 motion-reduce:transform-none"
      >
        <Image
          src="/images/home/milestone-shop-icon.webp"
          alt=""
          width={1254}
          height={1254}
          sizes="(min-width: 768px) 210px, 170px"
          className="aspect-[1287/1222] w-[170px] max-w-full object-contain drop-shadow-[0_8px_24px_rgba(0,229,213,0.16)] transition-[filter] duration-300 group-hover:drop-shadow-[0_8px_32px_rgba(0,229,213,0.32)] md:w-[210px]"
        />
        <span className="mt-2 text-sm font-semibold tracking-wide text-cyan-200 transition-colors group-hover:text-white">
          {t('link')}{' '}<span aria-hidden="true">→</span>
        </span>
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="fixed inset-0 m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-3xl border border-cyan-300/55 bg-[#04121d] bg-[radial-gradient(ellipse_at_top,#15394d,transparent_75%)] p-6 text-center text-[#f4f9ff] shadow-[0_0_40px_#1bd9ed35] backdrop:bg-[#020911]/85 backdrop:backdrop-blur-sm sm:p-10"
      >
        <form method="dialog">
          <button
            type="submit"
            aria-label={t('close')}
            className="absolute right-3 top-3 grid size-10 place-items-center rounded-full border border-white/15 text-cyan-100 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-cyan-300"
          >
            <X aria-hidden="true" size={20} />
          </button>
          <p className="px-8 text-xs font-bold tracking-[0.22em] text-[#48f4ff]">{t('brand')}</p>
          <h2 id={titleId} className="mt-3 text-3xl font-black italic sm:text-4xl">{t('title')}</h2>
          <div id={descriptionId} className="mt-5 space-y-3 text-sm leading-relaxed text-slate-200 sm:text-base">
            <p>{t('opening')}</p>
            <p>{t('description')}</p>
          </div>
          <button
            type="submit"
            autoFocus
            className="mt-7 min-h-11 rounded-xl bg-cyan-300 px-7 py-2 font-bold text-[#04121d] hover:bg-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
          >
            {t('confirm')}
          </button>
        </form>
      </dialog>
    </>
  )
}
