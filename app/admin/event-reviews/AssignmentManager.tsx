'use client'

import { useState, type FormEvent } from 'react'
import { supabase } from '@/app/lib/supabase'

type Target = { id: string; name: string; locality?: string }
type Edition = {
  id: string; title: string; date: string | null; city: string | null; country: string | null
  brand: string | null; series_id: string | null; organizer_id: string | null; review_count: number
}
type Overview = { editions: Edition[]; series: Target[]; organizers: Target[] }
type Choice = { id: string; name: string }
type View = 'editions' | 'series' | 'organizers'

const input = 'rounded-lg border border-white/20 bg-stone-900 px-3 py-2 text-sm'
const button = 'rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-50'
const emptyChoice = { id: '', name: '' }
const formatDate = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeZone: 'UTC' })
const countryNames = new Intl.DisplayNames('de', { type: 'region' })
const labelFor = (e: Edition) => [e.date ? formatDate.format(new Date(e.date)) : 'Termin offen', e.city, e.country].filter(Boolean).join(' · ')
const searchable = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('de')
const errors: Record<string, string> = {
  review_assignment_changed: 'Eine Zuordnung wurde inzwischen geändert. Die Übersicht wurde aktualisiert.',
  review_assignment_in_use: 'Ausgaben mit vorhandenen Bewertungen sind vor einer Neuzuordnung geschützt.',
  review_target_exists: 'Dieser Name ist bereits vorhanden. Bitte den bestehenden Eintrag auswählen.',
  review_target_missing: 'Für jede bisher nicht zugeordnete Ausgabe sind beide Zuordnungen erforderlich.',
  review_invalid_target: 'Bitte gültige Namen und Ziele angeben.',
}

function TargetPicker({ title, items, value, onChange }: {
  title: string; items: Target[]; value: Choice; onChange: (value: Choice) => void
}) {
  const [query, setQuery] = useState('')
  const matches = items.filter(item => searchable(item.name + ' ' + (item.locality ?? '')).includes(searchable(query)))
  const visible = matches.some(item => item.id === value.id) ? matches : [...items.filter(item => item.id === value.id), ...matches]
  return (
    <fieldset className="grid min-w-0 content-start gap-2 rounded-xl border border-white/10 p-3">
      <legend className="px-1 font-semibold">{title}</legend>
      <label className="grid gap-1 text-sm">Bestehende Einträge durchsuchen
        <input className={input} type="search" value={query} onChange={event => setQuery(event.target.value)} />
      </label>
      <label className="grid gap-1 text-sm">{title} auswählen
        <select className={input} value={value.id} onChange={event => onChange({ id: event.target.value, name: '' })}>
          <option value="">Bestehende Zuordnung beibehalten</option>
          <option value="new">Neu anlegen …</option>
          {visible.map(item => <option key={item.id} value={item.id}>{item.name}{item.locality ? ' · '+item.locality : ''}</option>)}
        </select>
      </label>
      {value.id === 'new' && <label className="grid gap-1 text-sm">Neuer Name
        <input className={input} maxLength={200} value={value.name} onChange={event => onChange({ id: 'new', name: event.target.value })} />
      </label>}
    </fieldset>
  )
}

function TargetDirectory({ title, kind, items, editions, onSaved }: {
  title: string; kind: 'series' | 'organizer'; items: Target[]; editions: Edition[]
  onSaved: () => Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState('')
  const [name, setName] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const active = items.find(item => item.id === selected)
  const matches = items.filter(item => searchable(item.name+' '+(item.locality ?? '')).includes(searchable(query)))
  const attached = editions.filter(edition => (kind === 'series' ? edition.series_id : edition.organizer_id) === selected)
  async function rename(event: FormEvent) {
    event.preventDefault()
    if (!active) return
    setSaving(true)
    const { error } = await supabase.rpc('uhl_rename_review_target_by_id', { p_kind: kind, p_id: active.id, p_name: name.trim() })
    setNotice(error ? errors[error.message] ?? 'Der Anzeigename konnte nicht gespeichert werden.' : 'Anzeigename gespeichert.')
    if (!error) await onSaved()
    setSaving(false)
  }
  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm">{title} durchsuchen
        <input className={input} type="search" value={query} onChange={event => setQuery(event.target.value)} />
      </label>
      <label className="grid gap-1 text-sm">Eintrag auswählen
        <select className={input} value={selected} onChange={event => {
          const id = event.target.value
          setSelected(id); setName(items.find(item => item.id === id)?.name ?? ''); setNotice('')
        }}>
          <option value="">Bitte auswählen</option>
          {matches.map(item => <option key={item.id} value={item.id}>{item.name}{item.locality ? ' · '+item.locality : ''}</option>)}
        </select>
      </label>
      {active && <div className="rounded-xl border border-white/10 p-4">
        <form className="flex flex-wrap items-end gap-3" onSubmit={rename}>
          <label className="grid min-w-0 flex-1 gap-1 text-sm">Öffentlicher Anzeigename
            <input className={input} value={name} required maxLength={200} onChange={event => setName(event.target.value)} />
          </label>
          <button className={button} disabled={saving || !name.trim() || name.trim() === active.name}>Anzeigenamen speichern</button>
        </form>
        {notice && <p role="status" className="mt-2 text-sm text-amber-200">{notice}</p>}
        <h3 className="mb-2 mt-4 font-semibold">Zugeordnete Ausgaben ({attached.length})</h3>
        <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
          {attached.map(edition => <li key={edition.id}>{edition.title} <span className="text-stone-400">· {labelFor(edition)}</span></li>)}
        </ul>
        {!attached.length && <p className="text-sm text-stone-400">Noch keine Ausgaben zugeordnet.</p>}
      </div>}
    </div>
  )
}

export default function AssignmentManager() {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<View>('editions')
  const [search, setSearch] = useState('')
  const [year, setYear] = useState('')
  const [country, setCountry] = useState('')
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [series, setSeries] = useState<Choice>(emptyChoice)
  const [organizer, setOrganizer] = useState<Choice>(emptyChoice)
  const [summary, setSummary] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  async function load() {
    setLoading(true)
    const { data: result, error } = await supabase.rpc('uhl_review_assignment_overview')
    if (error) setNotice('Die Zuordnungsübersicht konnte nicht geladen werden.')
    else setData(result as Overview)
    setLoading(false)
  }

  const seriesName = (id: string | null) => data?.series.find(item => item.id === id)?.name ?? 'Nicht zugeordnet'
  const organizerName = (id: string | null) => data?.organizers.find(item => item.id === id)?.name ?? 'Nicht zugeordnet'
  const selectedEditions = data?.editions.filter(edition => selected.includes(edition.id)) ?? []
  const assigned = data?.editions.filter(edition => edition.series_id).length ?? 0
  const visible = data?.editions.filter(edition =>
    (!year || edition.date?.startsWith(year)) &&
    (!country || edition.country === country) &&
    (!status || Boolean(edition.series_id) === (status === 'assigned')) &&
    searchable([edition.title, edition.city, edition.brand, organizerName(edition.organizer_id)].join(' ')).includes(searchable(search)),
  ) ?? []
  const nextName = (choice: Choice, current: string, lookup: (id: string | null) => string) =>
    choice.id === 'new' ? choice.name.trim()+' (neu)' : choice.id ? lookup(choice.id) : current
  const changes = selectedEditions.map(edition => ({
    edition,
    changed: Boolean((series.id && series.id !== edition.series_id) || (organizer.id && organizer.id !== edition.organizer_id)),
  }))
  const protectedChange = changes.some(({ edition, changed }) => changed && edition.review_count > 0)
  const incomplete = changes.some(({ edition }) => (!series.id && !edition.series_id) || (!organizer.id && !edition.organizer_id))
  const canPreview = changes.some(change => change.changed) && selected.length <= 100 &&
    (series.id !== 'new' || Boolean(series.name.trim())) && (organizer.id !== 'new' || Boolean(organizer.name.trim()))

  async function save() {
    setSaving(true)
    const { data: count, error } = await supabase.rpc('uhl_save_review_assignments', {
      p_editions: selectedEditions.map(({ id, series_id, organizer_id }) => ({ id, series_id, organizer_id })),
      p_series: series.id && series.id !== 'new' ? series.id : null,
      p_organizer: organizer.id && organizer.id !== 'new' ? organizer.id : null,
      p_new_series: series.id === 'new' ? series.name.trim() : null,
      p_new_organizer: organizer.id === 'new' ? organizer.name.trim() : null,
    })
    setNotice(error ? errors[error.message] ?? 'Die Zuordnungen konnten nicht gespeichert werden.' : `${count} Zuordnungen gespeichert.`)
    setSummary(false)
    if (!error) { setSelected([]); setSeries(emptyChoice); setOrganizer(emptyChoice) }
    await load()
    setSaving(false)
  }

  return (
    <details className="rounded-xl border border-white/15 p-4" onToggle={event => {
      if (event.currentTarget.open && !data && !loading) void load()
    }}>
      <summary className="cursor-pointer font-semibold">Reihen und Veranstalter zuordnen</summary>
      {loading && !data && <p role="status" className="mt-3 text-sm">Zuordnungen werden geladen …</p>}
      {notice && <p role="status" className="mt-3 text-sm text-amber-200">{notice}</p>}
      {!data && notice && <button className={button} onClick={() => void load()}>Erneut laden</button>}
      {data && <div className="mt-4 space-y-4">
        <dl className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {([
            ['Kalenderausgaben', data.editions.length], ['Zugeordnet', assigned],
            ['Nicht zugeordnet', data.editions.length - assigned], ['Veranstaltungsreihen', data.series.length],
            ['Veranstalter', data.organizers.length],
          ] as const).map(([label, count]) => <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <dt className="text-xs text-stone-300">{label}</dt><dd className="text-xl font-bold">{count}</dd>
          </div>)}
        </dl>
        <nav aria-label="Zuordnungsverwaltung" className="flex flex-wrap gap-2">
          {([['editions', 'Kalenderausgaben'], ['series', 'Veranstaltungsreihen'], ['organizers', 'Veranstalter']] as const).map(([key, title]) =>
            <button key={key} type="button" className={button} aria-pressed={view === key} onClick={() => setView(key)}>{title}</button>,
          )}
        </nav>
        {view === 'editions' ? <>
          <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-1">Veranstaltung, Veranstalter oder Ort
              <input className={input} type="search" value={search} onChange={event => setSearch(event.target.value)} />
            </label>
            <label className="grid gap-1">Zuordnungsstatus<select className={input} value={status} onChange={event => setStatus(event.target.value)}>
              <option value="">Alle</option><option value="assigned">Zugeordnet</option><option value="open">Nicht zugeordnet</option>
            </select></label>
            <label className="grid gap-1">Jahr<select className={input} value={year} onChange={event => setYear(event.target.value)}>
              <option value="">Alle Jahre</option>{[...new Set(data.editions.flatMap(edition => edition.date ? [edition.date.slice(0, 4)] : []))].sort().reverse().map(value => <option key={value}>{value}</option>)}
            </select></label>
            <label className="grid gap-1">Land<select className={input} value={country} onChange={event => setCountry(event.target.value)}>
              <option value="">Alle Länder</option>{[...new Set(data.editions.flatMap(edition => edition.country ? [edition.country] : []))].sort().map(value => <option key={value} value={value}>{/^[A-Z]{2}$/.test(value) ? countryNames.of(value) ?? value : value}</option>)}
            </select></label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-stone-300">
            <p>{visible.length} Treffer · {selected.length} ausgewählt</p>
            {selected.length > 0 && <button className={button} onClick={() => { setSelected([]); setSummary(false) }}>Auswahl zurücksetzen</button>}
          </div>
          <ul className="max-h-[32rem] divide-y divide-white/10 overflow-y-auto rounded-xl border border-white/10">
            {visible.map(edition => <li key={edition.id}>
              <label className="flex cursor-pointer items-start gap-3 p-3 hover:bg-white/5">
                <input type="checkbox" className="mt-1 size-4 accent-amber-400" checked={selected.includes(edition.id)}
                  onChange={event => {
                    const checked = event.target.checked
                    setSelected(current => checked ? [...current, edition.id] : current.filter(id => id !== edition.id))
                    setSummary(false)
                  }} />
                <span className="min-w-0">
                  <span className="block font-semibold">{edition.title}</span>
                  <span className="block text-xs text-stone-400">{labelFor(edition)}</span>
                  <span className="mt-1 block text-sm text-stone-300">Reihe: {seriesName(edition.series_id)} · Veranstalter: {organizerName(edition.organizer_id)}{edition.review_count > 0 ? ` · ${edition.review_count} vorhandene Bewertungen` : ''}</span>
                </span>
              </label>
            </li>)}
            {!visible.length && <li className="p-3 text-sm text-stone-400">Keine passenden Kalenderausgaben.</li>}
          </ul>
          {selected.length > 0 && <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <TargetPicker title="Veranstaltungsreihe" items={data.series} value={series} onChange={choice => { setSeries(choice); setSummary(false) }} />
              <TargetPicker title="Veranstalter" items={data.organizers} value={organizer} onChange={choice => { setOrganizer(choice); setSummary(false) }} />
            </div>
            {selected.length > 100 && <p className="text-sm text-amber-200">Bitte höchstens 100 Ausgaben pro Vorgang auswählen.</p>}
            <button type="button" className={button+' w-fit'} disabled={!canPreview || saving} onClick={() => setSummary(true)}>Änderungen prüfen</button>
          </div>}
          {summary && <div className="space-y-3 rounded-xl border border-amber-300/30 bg-amber-300/5 p-4">
            <h3 className="font-semibold">Zuordnungen vor dem Speichern</h3>
            <p className="text-sm text-stone-300">Neue Bewertungen folgen der neuen Zuordnung. Historische Bewertungen werden nicht verschoben.</p>
            <ul className="space-y-3 text-sm">
              {changes.filter(change => change.changed).map(({ edition }) => <li key={edition.id}>
                <p className="font-medium">{edition.title} · {labelFor(edition)}</p>
                <p className="text-stone-300">Reihe: {seriesName(edition.series_id)} → {nextName(series, seriesName(edition.series_id), seriesName)}</p>
                <p className="text-stone-300">Veranstalter: {organizerName(edition.organizer_id)} → {nextName(organizer, organizerName(edition.organizer_id), organizerName)}</p>
                {edition.review_count > 0 && <p className="text-amber-200">Gesperrt: {edition.review_count} vorhandene Bewertungen bleiben bei der bisherigen Zuordnung.</p>}
              </li>)}
            </ul>
            {incomplete && <p className="text-sm text-amber-200">Für bisher nicht zugeordnete Ausgaben bitte Reihe und Veranstalter auswählen.</p>}
            <button type="button" className={button} disabled={protectedChange || incomplete || saving} onClick={() => void save()}>Bestätigen und speichern</button>
          </div>}
        </> : view === 'series'
          ? <TargetDirectory key="series" title="Veranstaltungsreihen" kind="series" items={data.series} editions={data.editions} onSaved={load} />
          : <TargetDirectory key="organizers" title="Veranstalter" kind="organizer" items={data.organizers} editions={data.editions} onSaved={load} />}
      </div>}
    </details>
  )
}
