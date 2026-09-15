'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CalendarDays,
  Clock3,
  ExternalLink,
  MapPin,
  Plus,
  Trash2,
  Users,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import RecordSubmissionForm from '../../components/RecordSubmissionForm'


type CalendarEvent = {
  id: number
  event_master_id: number
  status: 'planned' | 'registered'
  event: {
    id: number
    slug: string
    title: string | null
    city: string | null
    country: string | null
    country_code: string | null
    event_date: string | null
    brand: string | null
    event_distances: {
      id: number
      label: string | null
      distance_km: number | null
      }[] | null
  } | null
}

function countryToFlag(countryCode: string | null) {
  if (!countryCode) return ''

  const code = countryCode.trim().toUpperCase()
  if (code.length !== 2) return ''

  return String.fromCodePoint(
    ...[...code].map((char) => 127397 + char.charCodeAt(0))
  )
}

function getEventCountdown(eventDate: string | null) {
  if (!eventDate) return '—'

  const event = new Date(eventDate)
  const today = new Date()

  event.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)

  const difference = event.getTime() - today.getTime()
  const days = Math.ceil(difference / (1000 * 60 * 60 * 24))

  if (days > 1) return `Noch ${days} Tage`
  if (days === 1) return 'Noch 1 Tag'
  if (days === 0) return 'Heute'
  if (days === -1) return 'Gestern'

  return `Vor ${Math.abs(days)} Tagen`
}

export default function PersonalCalendarPage() {

const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
const [loading, setLoading] = useState(true)
const [hikerId, setHikerId] = useState<number | null>(null)
const [submissionEventId, setSubmissionEventId] = useState<number | null>(null)

const [eventDistances, setEventDistances] = useState<
  Record<number, { id: number; label: string | null; distance_km: number | null }[]>
>({})

    useEffect(() => {
    async function loadCalendarEvents() {
        const {
        data: { session },
        } = await supabase.auth.getSession()

        if (!session?.user?.id) {
        setLoading(false)
        return
        }

        const { data: hikerData, error: hikerError } = await supabase
        .from('hikers')
        .select('id')
        .eq('claimed_by_user_id', session.user.id)
        .maybeSingle()

        if (hikerError) {
        console.error('Hiker-ID konnte nicht geladen werden:', hikerError)
        } else if (hikerData) {
        setHikerId(Number(hikerData.id))
        }

        const { data, error } = await supabase
        .from('user_event_calendar')
        .select(`
            id,
            event_master_id,
            status,
            event:events_master (
            id,
            slug,
            title,
            city,
            country,
            country_code,
            event_date,
            brand
        )   
            
        `)
        .eq('user_id', session.user.id)

        if (error) {
        console.error('Kalender konnte nicht geladen werden:', error)
        setLoading(false)
        return
        }

        console.log('Geladene Kalenderevents:', data)


        const eventIds = (data ?? []).map((item) => Number(item.event_master_id))

        if (eventIds.length > 0) {
        const { data: distancesData, error: distancesError } = await supabase
            .from('event_distances')
            .select('id, event_id, label, distance_km')
            .in('event_id', eventIds)
            .order('distance_km', { ascending: true })

        if (distancesError) {
            console.error('Distanzen konnten nicht geladen werden:', distancesError)
        } else {
            const groupedDistances: Record<
            number,
            { id: number; label: string | null; distance_km: number | null }[]
            > = {}

            ;(distancesData ?? []).forEach((distance) => {
            const eventId = Number(distance.event_id)

            if (!groupedDistances[eventId]) {
                groupedDistances[eventId] = []
            }

            groupedDistances[eventId].push({
                id: Number(distance.id),
                label: distance.label,
                distance_km:
                distance.distance_km !== null
                    ? Number(distance.distance_km)
                    : null,
            })
            })

            setEventDistances(groupedDistances)
        }
        }
                setCalendarEvents((data ?? []) as unknown as CalendarEvent[])
                setLoading(false)
            }

    loadCalendarEvents()
    }, []) 

    async function removeEventFromCalendar(calendarEntryId: number) {
        const { error } = await supabase
            .from('user_event_calendar')
            .delete()
            .eq('id', calendarEntryId)

        if (error) {
            console.error('Event konnte nicht aus dem Kalender entfernt werden:', error)
            return
        }

        setCalendarEvents((current) =>
            current.filter((item) => item.id !== calendarEntryId)
        )
        }

          async function updateEventStatus(
            calendarEntryId: number,
            newStatus: 'planned' | 'registered'
            ) {
            const { error } = await supabase
                .from('user_event_calendar')
                .update({ status: newStatus })
                .eq('id', calendarEntryId)

            if (error) {
                console.error('Eventstatus konnte nicht geändert werden:', error)
                return
            }

            setCalendarEvents((current) =>
                current.map((item) =>
                item.id === calendarEntryId
                    ? { ...item, status: newStatus }
                    : item
                )
            )
            }
            const visibleCalendarEvents = calendarEvents.filter((item) => {

            const eventDate = item.event?.event_date

            if (!eventDate) return true

            const eventDay = new Date(eventDate)

            eventDay.setHours(0, 0, 0, 0)

            const today = new Date()

            today.setHours(0, 0, 0, 0)

            const hideAfter = new Date(eventDay)

            hideAfter.setDate(hideAfter.getDate() + 7)

            return today <= hideAfter

        })
    
                return (
                    <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
                    <div className="mx-auto max-w-6xl">
                        <div
                            className="flex flex-wrap items-center"
                            style={{
                                columnGap: '24px',
                                rowGap: '8px',
                            }}
                            >
                            <Link
                                href="/"
                                className="text-sm text-stone-400 transition hover:text-white"
                            >
                                ← Zur Startseite
                            </Link>

                            <Link
                                href="/account"
                                className="text-sm text-stone-400 transition hover:text-white"
                            >
                                Zu meinem Profil
                            </Link>

                            <Link
                                href="/events"
                                className="text-sm text-stone-400 transition hover:text-white"
                            >
                                Events entdecken
                            </Link>
                            </div>

                        <div className="mt-8">
                        <div className="text-xs font-medium uppercase tracking-[0.22em] text-stone-500">
                            Persönlicher Eventkalender
                        </div>

                        <h1 className="mt-2 text-3xl font-bold text-white md:text-4xl">
                            Mein Kalender
                        </h1>

                        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-400">
                            Hier findest du die Events, die du geplant hast oder für die du
                            bereits angemeldet bist.
                        </p>
                        </div>

                        {loading ? (
                        <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 md:p-8">
                            <div className="text-sm text-stone-400">
                            Kalender wird geladen…
                            </div>
                        </div>
                        ) : visibleCalendarEvents.length > 0 ? (
                        <div className="mt-8 space-y-5">
                            {visibleCalendarEvents.map((item) => {
                                const event = item.event

                                const distances =
                                    eventDistances[item.event_master_id]
                                        ?.map(
                                        (distance) =>
                                            distance.label ?? `${distance.distance_km} km`
                                        )
                                        .join(' / ') ?? '—'

                                        
                                return (
                <div
                    key={item.id}
                    className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.035] to-black/30 p-6 shadow-2xl shadow-black/30 md:p-8"
                >
                    <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-400/[0.05] blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-white/[0.025] blur-3xl" />

                    <div className="relative">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-3xl">
                            {countryToFlag(event?.country_code ?? null)}
                            </span>

                            <h2 className="text-2xl font-bold text-white md:text-3xl">
                            {event?.city ?? 'Event'}
                            </h2>

                            <span
                                className="rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white"
                                style={{
                                    backgroundColor:
                                        item.status === 'registered'
                                            ? 'rgb(16 185 129)'
                                            : 'rgb(37 99 235)',
                                    borderColor:
                                        item.status === 'registered'
                                            ? 'rgb(52 211 153)'
                                            : 'rgb(96 165 250)',
                                }}
                            >
                                {item.status === 'registered' ? 'Angemeldet' : 'Geplant'}
                            </span>
                        </div>

                        <div className="mt-2 text-sm text-stone-400">
                            {event?.country ?? '—'}
                        </div>
                        </div>

                        
                    </div>

                    <div className="mt-7 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 px-5 py-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]">
                            <CalendarDays className="h-5 w-5 text-stone-200" />
                            </div>

                            <div className="min-w-0">
                            <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                                Veranstaltung
                            </div>

                            <div className="mt-1 text-lg font-semibold text-white">
                                {event?.title ?? '—'}
                            </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 px-5 py-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]">
                            <Users className="h-5 w-5 text-stone-200" />
                            </div>

                            <div className="min-w-0">
                            <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                                Veranstalter
                            </div>

                            <div className="mt-1 text-lg font-semibold text-white">
                                {event?.brand ?? '—'}
                            </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 px-5 py-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]">
                            <CalendarDays className="h-5 w-5 text-stone-200" />
                            </div>

                            <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                                Datum
                            </div>

                            <div className="mt-1 text-lg font-semibold text-white">
                                {event?.event_date
                                ? new Date(event.event_date).toLocaleDateString('de-DE')
                                : '—'}
                            </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 px-5 py-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]">
                                <MapPin className="h-5 w-5 text-stone-200" />
                            </div>

                            <div>
                                <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                                    Distanzen
                                </div>

                                <div className="mt-1 text-lg font-semibold text-white">
                                    {distances}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 px-5 py-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]">
                                <Clock3 className="h-5 w-5 text-stone-200" />
                            </div>

                            <div>
                                <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                                    Noch
                                </div>

                                <div className="mt-1 text-lg font-semibold text-white">
                                    {getEventCountdown(event?.event_date ?? null)}
                                </div>

                                <div className="text-xs text-stone-500">
                                    bis zum Event
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 px-5 py-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]">
                                <Users className="h-5 w-5 text-stone-200" />
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                                    Dein Status
                                </div>

                                <div
                                    className="mt-2 inline-flex border border-white/10 bg-black/30 p-1"
                                    style={{
                                        borderRadius: '12px',
                                        overflow: 'hidden',
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => updateEventStatus(item.id, 'planned')}
                                        className="rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
                                        style={{
                                            backgroundColor:
                                                item.status === 'planned'
                                                    ? 'rgb(37 99 235)'
                                                    : 'transparent',
                                            color:
                                                item.status === 'planned'
                                                    ? 'white'
                                                    : 'rgb(120 113 108)',
                                        }}
                                    >
                                        Geplant
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => updateEventStatus(item.id, 'registered')}
                                        className="rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
                                        style={{
                                            backgroundColor:
                                                item.status === 'registered'
                                                    ? 'rgb(16 185 129)'
                                                    : 'transparent',
                                            color:
                                                item.status === 'registered'
                                                    ? 'white'
                                                    : 'rgb(120 113 108)',
                                        }}
                                    >
                                        Angemeldet
                                    </button>
                                </div>
                            </div>
                        </div>

                        </div>

                    <div className="mt-6 flex flex-wrap gap-3 border-t border-white/10 pt-5">
                        {event?.slug ? (
                        <Link
                            href={`/events/${event.slug}`}
                            className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.07] px-5 py-3 text-sm font-semibold text-stone-100 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.13] hover:shadow-lg hover:shadow-black/20 active:translate-y-0 active:scale-[0.98]"
                        >
                            <ExternalLink className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                            Event öffnen
                        </Link>
                        ) : null}

                        {hikerId ? (
                            <button
                                type="button"
                                onClick={() => {
                                setSubmissionEventId(
                                    submissionEventId === item.event_master_id
                                    ? null
                                    : item.event_master_id
                                )
                                }}
                                className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.07] px-5 py-3 text-sm font-semibold text-stone-100 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.13] hover:shadow-lg hover:shadow-black/20 active:translate-y-0 active:scale-[0.98]"
                            >
                                <Plus className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                                {submissionEventId === item.event_master_id
                                ? 'Formular schließen'
                                : 'Wanderung hinzufügen'}
                            </button>
                            ) : null}

                        <button
                            type="button"
                            onClick={() => removeEventFromCalendar(item.id)}
                            className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-lg active:translate-y-0 active:scale-[0.98]"
                            style={{
                                backgroundColor: 'rgb(220 38 38)',
                                border: '1px solid rgb(248 113 113)',
                            }}
                        >
                            <Trash2 className="h-4 w-4 text-white transition-transform duration-200 group-hover:scale-110" />
                            Aus meinem Kalender entfernen
                        </button>
                    </div>
                    {submissionEventId === item.event_master_id && hikerId ? (
                        <div className="mt-6">
                            <RecordSubmissionForm
                            hikerId={hikerId}
                            preselectedEvent={{
                                eventMasterId: item.event_master_id,
                                title: event?.title ?? '',
                                date: event?.event_date ?? '',
                                country: event?.country ?? '',
                                city: event?.city ?? '',
                                organizer: event?.brand ?? '',
                                distanceKm:
                                eventDistances[item.event_master_id]?.length === 1
                                    ? eventDistances[item.event_master_id][0].distance_km
                                    : null,
                            }}
                            onSuccess={() => setSubmissionEventId(null)}
                            onCancel={() => setSubmissionEventId(null)}
                            />
                        </div>
                        ) : null}
                    </div>
                </div>
                )
            })}
            </div>
        ) : (
        <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 md:p-8">
            <div className="text-lg font-semibold text-white">
            Noch keine Events gespeichert
            </div>

            <p className="mt-2 text-sm text-stone-400">
            Events kannst du direkt aus dem Eventkalender zu deinem persönlichen
            Kalender hinzufügen.
            </p>

            <Link
            href="/events"
            className="mt-5 inline-flex rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-stone-100 transition hover:bg-white/10"
            >
            Events entdecken
            </Link>
        </div>
        )}
      </div>
    </main>
  )
}