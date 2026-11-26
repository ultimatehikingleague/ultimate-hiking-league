'use client'

import Link from 'next/link'
import VoucherCodes from './VoucherCodes'
import LaunchControl from './LaunchControl'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { isPartnerBenefit, partnerBenefitColumns } from '../../milestone-shop/PartnerBenefits'

type RewardType = 'voucher' | 'discount' | 'product' | 'benefit' | 'affiliate'
type Reward = {
  id: number
  title: string
  description: string | null
  partner_name: string
  reward_type: RewardType
  display_position?: number | null
  points_cost: number
  image_url: string | null
  is_active: boolean
  redemption_url: string | null
  redemption_instructions: string | null
  redeem_until?: string | null
  shared_code?: string | null
}
type Draft = {
  title: string
  description: string
  partner_name: string
  reward_type: RewardType
  display_position: string
  points_cost: string
  image_url: string
  is_active: boolean
  redemption_url: string
  redemption_instructions: string
  redeem_until: string
  shared_code: string
}

const columns = 'id,title,description,partner_name,reward_type,points_cost,image_url,is_active,redemption_url,redemption_instructions,display_position,redeem_until'
const labels: Record<RewardType, string> = { voucher: 'Gutschein', discount: 'Rabatt', product: 'Produkt', benefit: 'Kostenloser Partnervorteil', affiliate: 'Affiliate-Angebot' }
const emptyDraft: Draft = {
  title: '', description: '', partner_name: '', reward_type: 'voucher', points_cost: '', display_position: '',
  image_url: '', is_active: false, redemption_url: '', redemption_instructions: '', shared_code: '', redeem_until: '',
}
const inputClass = 'mt-2 w-full rounded-xl border border-white/15 bg-[#141312] px-4 py-3 text-white outline-none focus:border-cyan-400'
const buttonClass = 'rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50'
const imageTypes: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

function offerTable(type: RewardType) {
  return isPartnerBenefit(type) ? 'milestone_partner_benefits' : 'reward_catalog'
}

function offerKey(offer: Pick<Reward, 'id' | 'reward_type'>) {
  return offerTable(offer.reward_type) + '-' + offer.id
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
  return 'Unbekannter Fehler. Bitte versuche es erneut.'
}

function validateUrl(value: string) {
  if (!value.trim()) return true
  try { return new URL(value.trim()).protocol === 'https:' } catch { return false }
}

function deadlineInput(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function loadRewards() {
  return supabase.from('reward_catalog').select(columns)
    .order('display_position', { ascending: true, nullsFirst: false })
    .order('points_cost').order('id')
}

export default function MilestoneShopAdminPage() {
  const [access, setAccess] = useState<'loading' | 'allowed' | 'denied'>('loading')
  const [rewards, setRewards] = useState<Reward[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [benefitsLoadError, setBenefitsLoadError] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [logo, setLogo] = useState<File | null>(null)
  const [logoError, setLogoError] = useState('')
  const [draggingLogo, setDraggingLogo] = useState(false)
  const [newCodeRewardId, setNewCodeRewardId] = useState<number | null>(null)
  const [editing, setEditing] = useState<Reward | null>(null)
  const editingId = editing?.id ?? null
  const isFree = isPartnerBenefit(draft.reward_type)
  const offerLoadError = isFree ? benefitsLoadError : loadError
  const [busy, setBusy] = useState(false)
  const mutationLock = useRef(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          if (!cancelled) setAccess('denied')
          return
        }
        const { data: admin, error: adminError } = await supabase.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle()
        if (adminError || !admin) {
          if (!cancelled) setAccess('denied')
          return
        }
        if (!cancelled) setAccess('allowed')
        const [catalog, benefits] = await Promise.all([
          loadRewards(),
          supabase.from('milestone_partner_benefits').select(partnerBenefitColumns).order('id', { ascending: false }),
        ])
        if (!cancelled) {
          if (catalog.error) setLoadError(`Prämien konnten nicht geladen werden: ${errorMessage(catalog.error)}`)
          if (benefits.error) {
            const missingTable = ['PGRST205', '42P01'].includes(benefits.error.code)
            setBenefitsLoadError(missingTable
              ? 'Die Datenbank für Partnervorteile ist noch nicht eingerichtet.'
              : `Partnervorteile konnten nicht geladen werden: ${errorMessage(benefits.error)}`)
          }
          setRewards([
            ...(catalog.data ?? []) as Reward[],
            ...(benefits.data ?? []).map(benefit => ({ ...benefit, points_cost: 0 })) as Reward[],
          ])
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(`Angebote konnten nicht geladen werden: ${errorMessage(err)}`)
          setAccess(current => current === 'loading' ? 'denied' : current)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  function update<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft(previous => ({ ...previous, [field]: value }))
  }

  function reset() {
    setEditing(null)
    setDraft({ ...emptyDraft })
    setLogo(null)
    setLogoError('')
    setError('')
  }

  function selectLogo(file: File | undefined) {
    if (!file || mutationLock.current) return
    if (!imageTypes[file.type] || file.size === 0 || file.size > 5 * 1024 * 1024) {
      setLogoError('Bitte eine PNG-, JPG- oder WebP-Datei bis 5 MB auswählen.')
      return
    }
    setLogo(file)
    setLogoError('')
  }

  function edit(reward: Reward) {
    if (mutationLock.current) return
    setEditing(reward)
    setDraft({
      display_position: String(reward.display_position ?? ''),
      title: reward.title, description: reward.description ?? '', partner_name: reward.partner_name,
      reward_type: reward.reward_type, points_cost: String(reward.points_cost), image_url: reward.image_url ?? '',
      is_active: reward.is_active, redemption_url: reward.redemption_url ?? '', redemption_instructions: reward.redemption_instructions ?? '',
      shared_code: reward.shared_code ?? '', redeem_until: deadlineInput(reward.redeem_until),
    })
    setError('')
    setMessage('')
    setLogo(null)
    setLogoError('')
    headingRef.current?.focus()
    headingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutationLock.current || offerLoadError) return
    setError('')
    setMessage('')
    setNewCodeRewardId(null)
    setLogoError('')
    const cost = Number(draft.points_cost)
    const position = draft.display_position === '' ? null : Number(draft.display_position)
    if (!isFree && position !== null && (!Number.isInteger(position) || position < 1 || position > 2147483647)) {
      setError('Bitte eine positive ganze Zahl als Position angeben.')
      return
    }
    if (!draft.title.trim() || !draft.partner_name.trim()) {
      setError('Bitte Titel und Partnername angeben.')
      return
    }
    if (!isFree && (!/^\d+$/.test(draft.points_cost) || !Number.isInteger(cost) || cost < 1 || cost > 2147483647)) {
      setError('Die Milestone-Kosten müssen eine positive ganze Zahl bis 2.147.483.647 sein.')
      return
    }
    if ((!logo && !validateUrl(draft.image_url)) || !validateUrl(draft.redemption_url)) {
      setError('Bitte für Bild und Einlösung vollständige HTTPS-Adressen verwenden.')
      return
    }
    if (isFree && !draft.redemption_url.trim()) {
      setError('Bitte den Ziellink zum Partnerangebot angeben.')
      return
    }
    const deadline = !isFree && draft.redeem_until ? new Date(draft.redeem_until) : null
    if (deadline && (!Number.isFinite(deadline.getTime()) || deadlineInput(deadline.toISOString()) !== draft.redeem_until)) {
      setError('Die Einlösefrist ist in der Gerätezeitzone ungültig.')
      return
    }
    const redeemUntil = draft.redeem_until === deadlineInput(editing?.redeem_until)
      ? editing?.redeem_until ?? null : deadline?.toISOString() ?? null
    mutationLock.current = true
    setBusy(true)
    try {
      let imageUrl = draft.image_url.trim() || null
      if (logo) {
        const storage = supabase.storage.from('partner-assets')
        const path = `logos/milestone-${crypto.randomUUID()}.${imageTypes[logo.type]}`
        const { error: uploadError } = await storage.upload(path, logo, { contentType: logo.type })
        if (uploadError) {
          setLogoError(`Bild konnte nicht hochgeladen werden: ${uploadError.message}`)
          return
        }
        imageUrl = storage.getPublicUrl(path).data.publicUrl
        // Keep the uploaded URL for a retry if the catalog save fails.
        update('image_url', imageUrl)
        setLogo(null)
      }
      const payload = {
        title: draft.title.trim(), partner_name: draft.partner_name.trim(), reward_type: draft.reward_type,
        description: draft.description.trim() || null, image_url: imageUrl,
        is_active: draft.is_active, redemption_url: draft.redemption_url.trim() || null,
        redemption_instructions: draft.redemption_instructions.trim() || null,
      }
      let savedId: number
      if (isFree) {
        const fields = { ...payload, shared_code: draft.shared_code.trim() || null }
        const benefits = supabase.from('milestone_partner_benefits')
        const query = editingId === null
          ? benefits.insert(fields)
          : benefits.update({ ...fields, updated_at: new Date().toISOString() }).eq('id', editingId)
        const { data, error: saveError } = await query.select(partnerBenefitColumns).single()
        if (saveError) throw saveError
        const saved = { ...data, points_cost: 0 } as Reward
        savedId = saved.id
        setRewards(previous => editingId === null ? [...previous, saved] : previous.map(item => offerKey(item) === offerKey(saved) ? saved : item))
      } else {
        const { data, error: saveError } = await supabase.rpc('save_positioned_milestone_reward', {
          p_id: editingId,
          p_position: position,
          p_reward: { ...payload, points_cost: cost, redeem_until: redeemUntil },
        })
        if (saveError) throw saveError
        savedId = Number(data)
        const { data: catalog, error: refreshError } = await loadRewards()
        if (refreshError) {
          reset()
          setLoadError('Prämie gespeichert. Lade die Seite neu, um die aktualisierte Reihenfolge zu sehen.')
          return
        }
        setRewards(previous => [...(catalog as Reward[]), ...previous.filter(item => isPartnerBenefit(item.reward_type))])
      }
      if (editingId === null && !isFree && draft.reward_type !== 'product') {
        setNewCodeRewardId(savedId)
        setMessage('Angebot wurde angelegt. Du kannst jetzt die Gutscheincodes hinzufügen.')
      } else {
        setMessage(editingId === null ? 'Angebot wurde angelegt.' : 'Änderungen wurden gespeichert.')
      }
      reset()
    } catch (err) {
      setError(`Speichern fehlgeschlagen: ${errorMessage(err)}`)
    } finally {
      mutationLock.current = false
      setBusy(false)
    }
  }

  async function toggle(reward: Reward) {
    if (mutationLock.current || (editing !== null && offerKey(editing) === offerKey(reward))) return
    mutationLock.current = true
    setBusy(true)
    setError('')
    setMessage('')
    setNewCodeRewardId(null)
    try {
      const { error: updateError } = await supabase.from(offerTable(reward.reward_type))
        .update({ is_active: !reward.is_active, updated_at: new Date().toISOString() })
        .eq('id', reward.id).select('id').single()
      if (updateError) throw updateError
      setRewards(previous => previous.map(item => offerKey(item) === offerKey(reward) ? { ...item, is_active: !reward.is_active } : item))
      setMessage(`„${reward.title}“ wurde ${reward.is_active ? 'deaktiviert' : 'aktiviert'}.`)
    } catch (err) {
      setError(`Statusänderung fehlgeschlagen: ${errorMessage(err)}`)
    } finally {
      mutationLock.current = false
      setBusy(false)
    }
  }

  async function remove(reward: Reward) {
    if (mutationLock.current || reward.is_active) return
    if (!window.confirm(`„${reward.title}“ endgültig löschen?\n\nDas Angebot und seine unvergebenen Gutscheincodes werden entfernt. Angebote mit Einlösungen oder bereits zugewiesenen Codes sind gesperrt. Diese Aktion kann in der Oberfläche nicht rückgängig gemacht werden.`)) return
    mutationLock.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { error: deleteError } = await supabase.rpc('delete_inactive_milestone_offer', {
        p_offer_table: offerTable(reward.reward_type), p_id: reward.id, p_confirm: true,
      })
      if (deleteError) throw deleteError
      if (editing && offerKey(editing) === offerKey(reward)) reset()
      if (newCodeRewardId === reward.id && !isPartnerBenefit(reward.reward_type)) setNewCodeRewardId(null)
      setRewards(previous => previous.filter(item => offerKey(item) !== offerKey(reward)))
      setMessage(`„${reward.title}“ wurde endgültig gelöscht.`)
    } catch (err) {
      setError(`Löschen fehlgeschlagen: ${errorMessage(err)}`)
    } finally {
      mutationLock.current = false
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#141312] px-6 py-12 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin" className="text-sm text-stone-400 hover:text-white">← Zurück zur UHL-Administration</Link>
        {access === 'loading' ? <p className="mt-8 text-stone-400" role="status">Milestone-Verwaltung wird geladen …</p>
          : access === 'denied' ? <section className="mt-8 rounded-3xl border border-white/10 p-8"><h1 className="text-2xl font-bold">Kein Zugriff</h1><p className="mt-3 text-stone-400">Melde dich mit deinem Admin-Konto an, um Angebote zu verwalten.</p><Link href="/login" className="mt-4 inline-block text-cyan-300 underline">Anmelden</Link>{loadError && <p role="alert" className="mt-3 text-red-300">{loadError}</p>}</section>
          : <>
            <section className="mt-8 rounded-[2rem] border border-cyan-400/20 bg-gradient-to-br from-cyan-400/[0.08] to-white/[0.02] p-7 md:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">ULTIMATE MILESTONE SHOP</p>
              <h1 className="mt-4 text-3xl font-bold md:text-5xl">Milestone-Shop verwalten</h1>
              <p className="mt-4 text-stone-400">Angebote und Einlösehinweise für deine Milestone-Prämien pflegen.</p>
              
            </section>

            <LaunchControl />
            {process.env.NODE_ENV === 'development' && <Link href="/admin/milestone-shop/design-vorschau" className="mt-4 inline-block text-sm text-cyan-300 underline">Lokale Vorschau mit Beispielangeboten →</Link>}
            <div className="mt-6" aria-live="polite">{message && <p role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-emerald-200">{message}</p>}</div>
            {message && newCodeRewardId !== null && <a className="mt-2 inline-block text-sm text-cyan-300 underline" href={`#gutscheincodes-${newCodeRewardId}`}>Zum Codeimport →</a>}
            {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-red-200">{error}</p>}

            <div className="mt-8 grid items-start gap-8 xl:grid-cols-2">
              <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
                <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold">{editingId === null ? 'Angebot anlegen' : 'Angebot bearbeiten'}</h2>
                <p className="mt-2 text-sm text-stone-400">Pflichtfelder sind mit * markiert. Neue Angebote sind zunächst inaktiv.</p>
                <form onSubmit={save} className="mt-6">
                  <fieldset disabled={busy || loading} className="space-y-5 disabled:opacity-60">
                    <label className="block text-sm text-stone-300">Titel *<input required placeholder={isFree ? 'z. B. 15 % auf das gesamte Sortiment' : undefined} maxLength={500} value={draft.title} onChange={event => update('title', event.target.value)} className={inputClass} /></label>
                    <label className="block text-sm text-stone-300">Partnername *<input required value={draft.partner_name} onChange={event => update('partner_name', event.target.value)} className={inputClass} /></label>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <label className="block text-sm text-stone-300">Angebotstyp *<select value={draft.reward_type} onChange={event => update('reward_type', event.target.value as RewardType)} className={inputClass}>{Object.entries(labels).filter(([type]) => !editing || offerTable(type as RewardType) === offerTable(editing.reward_type)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                      {!isFree && <label className="block text-sm text-stone-300">Milestone-Kosten *<input required type="number" min="1" max="2147483647" step="1" value={draft.points_cost} onChange={event => update('points_cost', event.target.value)} className={inputClass} /></label>}
                    </div>
                    {!isFree && <label className="block text-sm text-stone-300">
                      Position im Prämienraster
                      <input type="number" min="1" max="2147483647" step="1" placeholder={editing ? 'Position beibehalten' : 'Am Ende einfügen'} value={draft.display_position} onChange={event => update('display_position', event.target.value)} className={inputClass} />
                      <span className="mt-2 block text-xs text-stone-400">Position 1 steht zuerst. Beim Einfügen rücken die übrigen Karten automatisch weiter.</span>
                    </label>}
                    <label className="block text-sm text-stone-300">Beschreibung<textarea rows={3} value={draft.description} onChange={event => update('description', event.target.value)} className={inputClass} /></label>
                    <div>
                      <p className="text-sm text-stone-300">Bild oder Logo</p>
                      <div
                        className={`mt-2 rounded-xl border border-dashed p-4 text-sm ${draggingLogo ? 'border-cyan-300 bg-cyan-300/10' : 'border-white/20'}`}
                        onDragOver={event => { event.preventDefault(); if (!busy && !loading && !offerLoadError) setDraggingLogo(true) }}
                        onDragLeave={() => setDraggingLogo(false)}
                        onDrop={event => {
                          event.preventDefault()
                          setDraggingLogo(false)
                          if (!busy && !loading && !offerLoadError) selectLogo(event.dataTransfer.files[0])
                        }}
                      >
                        <p>Logo hierher ziehen oder eine Datei auswählen.</p>
                        <input aria-label="Bild oder Logo auswählen" type="file" accept="image/png,image/jpeg,image/webp" className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white" onChange={event => { selectLogo(event.target.files?.[0]); event.target.value = '' }} />
                        <p className="mt-2 text-xs text-stone-400">PNG, JPG oder WebP bis 5 MB. Das Bild wird beim Speichern hochgeladen.</p>
                        {logo && <p className="mt-2 break-all text-cyan-200">{logo.name} <button type="button" className="ml-2 underline" onClick={() => { setLogo(null); setLogoError('') }}>Datei entfernen</button></p>}
                        {logoError && <p role="alert" className="mt-2 text-red-300">{logoError}</p>}
                      </div>
                      <label className="mt-3 block text-sm text-stone-300">Alternativ Bild-URL (HTTPS)<input type="url" disabled={!!logo} placeholder="https://…" value={draft.image_url} onChange={event => update('image_url', event.target.value)} className={inputClass} /></label>
                    </div>
                    <label className="block text-sm text-stone-300">{isFree ? 'Ziellink (HTTPS) *' : 'Einlöse-URL (HTTPS)'}<input required={isFree} type="url" placeholder="https://…" value={draft.redemption_url} onChange={event => update('redemption_url', event.target.value)} className={inputClass} /></label>
                    {isFree && <label className="block text-sm text-stone-300">Gemeinsamer Rabattcode (optional)<input value={draft.shared_code} onChange={event => update('shared_code', event.target.value)} className={inputClass} /></label>}
                    <label className="block text-sm text-stone-300">Hinweise zur Einlösung<textarea rows={4} value={draft.redemption_instructions} onChange={event => update('redemption_instructions', event.target.value)} className={inputClass} /></label>
                    {!isFree && <label className="block text-sm text-stone-300">Einlösefrist (optional, Gerätezeit)
                      <input type="datetime-local" value={draft.redeem_until} onChange={event => update('redeem_until', event.target.value)} className={inputClass} />
                      <span className="mt-1 block text-xs text-stone-400">Ab diesem Zeitpunkt wird das Angebot ausgeblendet. Bereits zugeteilte Gutscheine behalten ihre Gültigkeit.</span>
                    </label>}
                    <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={draft.is_active} onChange={event => update('is_active', event.target.checked)} className="h-4 w-4 accent-cyan-400" />Angebot aktivieren</label>
                    {!isFree && draft.reward_type !== 'product' && <p className="text-xs leading-5 text-stone-400">Speichere zuerst das Angebot. Danach kannst du unter „Gutscheincodes &amp; Bestand“ einen Code pro Zeile einfügen oder eine Datei importieren.</p>}
                    {offerLoadError && <p role="status" className="text-sm text-amber-200">{offerLoadError}</p>}
                    <div className="flex flex-wrap gap-3">
                      <button type="submit" disabled={!!offerLoadError} className={`${buttonClass} border-cyan-400/30 bg-cyan-400/10 text-cyan-200`}>{busy ? 'Wird gespeichert …' : editingId === null ? 'Angebot anlegen' : 'Änderungen speichern'}</button>
                      {editingId !== null && <button type="button" onClick={reset} className={buttonClass}>Bearbeitung abbrechen</button>}
                    </div>
                  </fieldset>
                </form>
              </section>

              <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
                <h2 className="text-2xl font-semibold">Angebote {!loading && !loadError && `(${rewards.length})`}</h2>
                {[loadError, benefitsLoadError].filter(Boolean).map(message => <p key={message} role="alert" className="mt-4 text-sm text-amber-200">{message}</p>)}
                {loading ? <p role="status" className="mt-6 text-stone-400">Angebote werden geladen …</p>
                  : rewards.length === 0 ? <p className="mt-6 text-stone-400">Noch keine Angebote vorhanden. Lege hier dein erstes Angebot an.</p>
                  : <div className="mt-6 space-y-4">{rewards.map(reward => <article key={offerKey(reward)} className="rounded-2xl border border-white/10 bg-black/15 p-5">
                    <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="break-words text-xs uppercase tracking-wider text-cyan-300">{reward.partner_name}</p><h3 className="mt-2 break-words text-xl font-semibold">{reward.title}</h3></div><span className={`shrink-0 rounded-full px-3 py-1 text-xs ${reward.is_active ? 'bg-emerald-400/10 text-emerald-200' : 'bg-white/5 text-stone-400'}`}>{reward.is_active ? 'Aktiv' : 'Inaktiv'}</span></div>
                    <p className="mt-3 text-sm text-stone-300">{reward.display_position != null && `Position ${reward.display_position} · `}{labels[reward.reward_type]} · {isPartnerBenefit(reward.reward_type) ? 'Ohne Milestones' : reward.points_cost.toLocaleString('de-DE') + ' Milestones'}</p>
                    {reward.description && <p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-stone-400">{reward.description}</p>}
                    <div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={() => edit(reward)} className={buttonClass}>Bearbeiten</button><button type="button" disabled={busy || (editing !== null && offerKey(editing) === offerKey(reward))} onClick={() => void toggle(reward)} className={buttonClass}>{reward.is_active ? 'Deaktivieren' : 'Aktivieren'}</button></div>
                    <button type="button" disabled={busy || reward.is_active} onClick={() => void remove(reward)} className={`${buttonClass} mt-3 text-red-300`} title={reward.is_active ? 'Vor dem Löschen zuerst deaktivieren.' : undefined}>Endgültig löschen</button>
                    {!isPartnerBenefit(reward.reward_type) && reward.reward_type !== 'product' && <VoucherCodes rewardId={reward.id} title={reward.title} initiallyOpen={reward.id === newCodeRewardId} />}
                  </article>)}</div>}
              </section>
            </div>
          </>}
      </div>
    </main>
  )
}
