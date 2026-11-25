import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { digitsOnly, isValidName, isValidPhone } from '../../lib/name'
import { DEFAULT_RETURN_GRACE_DAYS } from '../../lib/shop'

type Booking = {
  id: string
  customer_name: string | null
  start_date: string // 'YYYY-MM-DD'
  end_date: string
  return_grace_days: number | null
  buffer_days: number | null
  status: string | null
}
type Item = {
  id: string
  shop_id: string
  name: string
  buffer_days: number | null
  branches: { name: string } | null
  bookings: Booking[]
}
type Color = 'reserved' | 'booked' | 'returned' | 'cleaning'

/* ---------- helpers ---------- */
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (s: string, n: number) => {
  const [y, m, d] = s.split('-').map(Number)
  return iso(new Date(y, m - 1, d + n))
}
const norm = (s: string | null) => (s ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
// "CDO Uptown" -> U, "CDO Downtown" -> D (first letter of the last word)
const codeOf = (name: string) => name.trim().split(/\s+/).pop()![0].toUpperCase()

/* ---------- the rule: booking + date -> color ---------- */
const RENTAL_COLOR: Record<string, Color> = {
  pending: 'reserved',
  reserved: 'reserved',
  confirmed: 'reserved',
  out: 'booked',
  picked_up: 'booked',
  active: 'booked',
  in_transit: 'returned',
  returned: 'returned',
  completed: 'returned',
  cleaning: 'returned',
  ready: 'returned',
}
const OUT = ['out', 'picked_up', 'active']
const NEEDS_CLEANING = ['returned', 'in_transit', 'cleaning', 'completed']

function cellFor(b: Booking, buffer: number, day: string, today: string) {
  const status = norm(b.status)
  if (status === 'cancelled' || status === 'canceled') return null
  const graceEnd = addDays(b.end_date, b.return_grace_days ?? DEFAULT_RETURN_GRACE_DAYS)

  // Between start and end: color depends on the status
  if (day >= b.start_date && day <= b.end_date) {
    return { color: RENTAL_COLOR[status] ?? ('reserved' as Color), late: false }
  }
  if (!NEEDS_CLEANING.includes(status) && day > b.end_date && day <= graceEnd) {
    return { color: RENTAL_COLOR[status] ?? ('reserved' as Color), late: false }
  }
  // Not returned after the grace period: stays booked and flagged late until today
  if (OUT.includes(status) && day > graceEnd && day <= today) {
    return { color: 'booked' as Color, late: true }
  }
  // Buffer days after a return: cleaning
  if (NEEDS_CLEANING.includes(status) && day > b.end_date && day <= addDays(b.end_date, buffer)) {
    return { color: 'cleaning' as Color, late: false }
  }
  return null
}

function blockedReason(item: Item, day: string, today: string) {
  for (const b of item.bookings) {
    const status = norm(b.status)
    if (status === 'cancelled' || status === 'canceled' || status === 'declined') continue

    const buffer = b.buffer_days ?? item.buffer_days ?? 0
    const graceEnd = addDays(b.end_date, b.return_grace_days ?? DEFAULT_RETURN_GRACE_DAYS)
    if (day >= b.start_date && day <= b.end_date) {
      return 'Booked: item is reserved'
    }
    if (!NEEDS_CLEANING.includes(status) && day > b.end_date && day <= graceEnd) {
      return `Return grace period: item is unavailable until ${graceEnd}`
    }
    if (OUT.includes(status) && day > graceEnd && day <= today) {
      return 'Blocked: item is late and not yet returned'
    }
    if (NEEDS_CLEANING.includes(status) && day > b.end_date && day <= addDays(b.end_date, buffer)) {
      return `Cleaning buffer: ${buffer} day${buffer === 1 ? '' : 's'} after return`
    }
  }
  return ''
}

function rangeBlockedReason(item: Item, start: string, nights: number, today: string) {
  const end = addDays(start, nights - 1)
  const requestedBuffer = item.buffer_days ?? 0
  const requestedStart = addDays(start, -requestedBuffer)
  const requestedEnd = addDays(end, DEFAULT_RETURN_GRACE_DAYS + requestedBuffer)

  for (const b of item.bookings) {
    const status = norm(b.status)
    if (status === 'cancelled' || status === 'canceled' || status === 'declined') continue

    const buffer = b.buffer_days ?? item.buffer_days ?? 0
    const graceDays = NEEDS_CLEANING.includes(status)
      ? 0
      : b.return_grace_days ?? DEFAULT_RETURN_GRACE_DAYS
    const graceEnd = addDays(b.end_date, graceDays)
    const blockedStart = addDays(b.start_date, -buffer)
    const blockedEnd = addDays(graceEnd, buffer)
    if (requestedStart <= blockedEnd && blockedStart <= requestedEnd) {
      if (dayInsideBooking(start, end, b.start_date, b.end_date)) {
        return 'Booked: item is reserved'
      }
      if (graceDays && requestedStart <= graceEnd && requestedEnd > b.end_date) {
        return `Unavailable during the ${graceDays}-day return grace period`
      }
      if (OUT.includes(status) && start <= today && end >= graceEnd) {
        return 'Blocked: item is late and not yet returned'
      }
      if (NEEDS_CLEANING.includes(status)) {
        return `Cleaning buffer: ${buffer} day${buffer === 1 ? '' : 's'} after return`
      }
      return 'Blocked: another booking or its cleaning buffer overlaps'
    }
  }
  return ''
}

function dayInsideBooking(start: string, end: string, bookingStart: string, bookingEnd: string) {
  return start <= bookingEnd && bookingStart <= end
}

const COLOR_CLASS: Record<Color, string> = {
  reserved: 'bg-reserved text-white',
  booked: 'bg-booked text-white',
  returned: 'bg-returned text-white',
  cleaning: 'bg-cleaning text-white',
}
const LEGEND: { color: Color; label: string }[] = [
  { color: 'reserved', label: 'Reserved' },
  { color: 'booked', label: 'Booked' },
  { color: 'returned', label: 'Returned' },
  { color: 'cleaning', label: 'Cleaning' },
]

const fieldCls = 'mt-1 w-full rounded-sm border border-ink/25 bg-white px-3 py-2.5 text-sm text-ink'

export default function CalendarPage({ branch }: { branch: string }) {
  const today = iso(new Date())
  const [month, setMonth] = useState(today.slice(0, 7)) // 'YYYY-MM'
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  // walk-in form
  const [itemId, setItemId] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [nights, setNights] = useState(2)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [y, m] = month.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate() // 28, 29, 30 or 31
  const days = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
    [month, daysInMonth]
  )
  const cols = { gridTemplateColumns: `170px repeat(${daysInMonth}, minmax(0, 1fr))` }

  const shiftMonth = (n: number) => setMonth(iso(new Date(y, m - 1 + n, 1)).slice(0, 7))

  useEffect(() => {
    setLoading(true)
    supabase
      .from('items')
      .select('id, shop_id, name, buffer_days, branches(name), bookings(id, customer_name, start_date, end_date, return_grace_days, buffer_days, status)')
      .lte('bookings.start_date', days[days.length - 1])
      .gte('bookings.end_date', addDays(days[0], -30)) // margin so late/cleaning days still show
      .order('name')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else { setError(''); setItems((data ?? []) as unknown as Item[]) }
        setLoading(false)
      })
  }, [days, reload])

  const visible = items.filter((i) => branch === 'All branches' || i.branches?.name === branch)
    const multi = new Set(items.map((i) => i.branches?.name)).size > 1
  const chosenId = visible.find((i) => i.id === itemId)?.id ?? visible[0]?.id ?? ''
  const legendBranches = [
    ...new Map(visible.filter((i) => i.branches).map((i) => [codeOf(i.branches!.name), i.branches!.name])),
  ]
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
  const chosenItem = visible.find((i) => i.id === chosenId)
  const startReason = chosenItem ? rangeBlockedReason(chosenItem, startDate, nights, today) : ''

  async function addBooking(e: FormEvent) {
    e.preventDefault()
    if (!isValidName(name)) {
      setMsg({ ok: false, text: 'Customer name must contain letters and cannot contain numbers.' })
      return
    }
    if (!isValidPhone(phone)) {
      setMsg({ ok: false, text: 'Enter a phone number using 10 to 15 digits.' })
      return
    }
    const item = visible.find((i) => i.id === chosenId)
    if (!item) return
    setSaving(true)
    setMsg(null)

    const buffer = item.buffer_days ?? 0
    const endDate = addDays(startDate, nights - 1)

    // Block dates that overlap another booking or its cleaning days
    const { data: bookings, error: clashErr } = await supabase
      .from('bookings')
      .select('start_date, end_date, return_grace_days, buffer_days')
      .eq('item_id', item.id)
      .neq('status', 'cancelled')
      .neq('status', 'canceled')
      .neq('status', 'declined')

    if (clashErr) {
      setMsg({ ok: false, text: clashErr.message })
      setSaving(false)
      return
    }
    const requestedStart = addDays(startDate, -buffer)
    const requestedEnd = addDays(endDate, DEFAULT_RETURN_GRACE_DAYS + buffer)
    const clash = bookings?.some((booking) => {
      const existingBuffer = booking.buffer_days ?? buffer
      const existingStart = addDays(booking.start_date, -existingBuffer)
      const existingEnd = addDays(
        booking.end_date,
        (booking.return_grace_days ?? DEFAULT_RETURN_GRACE_DAYS) + existingBuffer
      )
      return requestedStart <= existingEnd && existingStart <= requestedEnd
    })
    if (clash) {
      setMsg({ ok: false, text: 'Those dates are not available. Another booking or its cleaning days overlap.' })
      setSaving(false)
      return
    }

    const { error: insErr } = await supabase.from('bookings').insert({
      shop_id: item.shop_id,
      item_id: item.id,
      customer_name: name.trim(),
      customer_phone: phone.trim() || null,
      start_date: startDate,
      end_date: endDate,
      buffer_days: buffer,
      status: 'reserved',
    })
    if (insErr) {
      setMsg({
        ok: false,
        text: insErr.message.includes('DATES_UNAVAILABLE')
          ? 'Those dates are no longer available. Pick other dates.'
          : insErr.message,
      })
    } else {
      setMsg({ ok: true, text: `Booking added for ${name.trim()}.` })
      setName('')
      setPhone('')
      setMonth(startDate.slice(0, 7)) // show the month of the new booking
      setReload((n) => n + 1)
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <section className="rounded-sm bg-white p-8 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Bookings</h2>
          <div className="flex items-center gap-3 text-sm">
            <button aria-label="Previous month" onClick={() => shiftMonth(-1)}>
              <ChevronLeft size={18} />
            </button>
            <span className="w-36 text-center font-medium">{monthLabel}</span>
            <button aria-label="Next month" onClick={() => shiftMonth(1)}>
              <ChevronRight size={18} />
            </button>
            <button
              onClick={() => setMonth(today.slice(0, 7))}
              className="rounded-sm border border-ink/25 px-3 py-1"
            >
              Today
            </button>
          </div>
        </div>

        <div className="mb-3 flex gap-4">
          {LEGEND.map(({ color, label }) => (
            <div key={color} className="flex flex-col items-center gap-1">
              <span className={`h-6 w-12 rounded-sm shadow ${COLOR_CLASS[color].split(' ')[0]}`} />
              <span className="text-sm text-ink">{label}</span>
            </div>
          ))}
          <div className="flex flex-col items-center gap-1">
            <span className="h-6 w-12 rounded-sm bg-booked shadow" />
            <span className="text-sm text-ink">Late</span>
          </div>
        </div>
        <p className="mb-6 text-sm leading-tight text-ink">
          {(multi ? legendBranches : []).map(([code, bName]) => (
            <span key={code} className="block">
              {code} = {bName}
            </span>
          ))}
        </p>

        {error && <p className="mb-4 text-sm text-cleaning">Could not load bookings: {error}</p>}
        {loading && <p className="mb-4 text-sm text-ink/60">Loading...</p>}
        {!loading && !error && visible.length === 0 && (
          <p className="text-sm text-ink/60">No items yet. Add items to this shop to see them here.</p>
        )}

        <div className="overflow-x-auto">
          <div className="min-w-[1000px]">
            <div style={cols} className="grid gap-x-1 pb-2 text-sm font-medium">
              <span />
              {days.map((d) => (
                <span
                  key={d}
                  className={`text-center ${d === today ? 'font-bold underline underline-offset-4' : ''}`}
                >
                  {d.slice(8)}
                </span>
              ))}
            </div>

            {visible.map((item) => (
              <div key={item.id} style={cols} className="mb-2 grid items-center gap-x-1">
                <span className="truncate pr-2 text-sm">{item.name}</span>
                {days.map((d) => {
                  let hit: { b: Booking; color: Color; late: boolean } | null = null
                  for (const b of item.bookings) {
                    const buffer = b.buffer_days ?? item.buffer_days ?? 0
                    const c = cellFor(b, buffer, d, today)
                    if (c) {
                      hit = { b, ...c }
                      break
                    }
                  }
                  return hit ? (
                    <div
                      key={d}
                      title={`${norm(hit.b.status).replace('_', ' ')}${hit.late ? ' · late' : ''}`}
                      onClick={() => {
                        setStartDate(d)
                        setMsg({ ok: false, text: blockedReason(item, d, today) || 'Those dates are not available.' })
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setStartDate(d)
                          setMsg({ ok: false, text: blockedReason(item, d, today) || 'Those dates are not available.' })
                        }
                      }}
                      className={`flex h-6 cursor-not-allowed items-center justify-center rounded-sm text-sm font-bold ${COLOR_CLASS[hit.color]}`}
                    >
                      {multi && item.branches ? codeOf(item.branches.name) : ''}
                    </div>
                  ) : (
                    <button
                      key={d}
                      type="button"
                      title={`Use ${d} as start date`}
                      onClick={() => {
                        setItemId(item.id)
                        setStartDate(d)
                        setMsg(null)
                      }}
                      className="h-6 rounded-sm bg-cell hover:ring-1 hover:ring-ink/30"
                      aria-label={`Choose ${d} for ${item.name}`}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-sm bg-white p-8 shadow-sm">
        <h2 className="mb-5 text-lg font-semibold">Add a walk-in booking</h2>
        <form
          onSubmit={addBooking}
          className="grid max-w-3xl grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2"
        >
          <label className="text-sm text-ink/70">
            Item
            <select
              className={fieldCls}
              value={chosenId}
              onChange={(e) => setItemId(e.target.value)}
              required
            >
              {visible.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-ink/70">
            Start date
            <input
              type="date"
              className={fieldCls}
              value={startDate}
              min={today}
              required
              onChange={(e) => {
                setStartDate(e.target.value)
                setMsg(null)
              }}
            />
            {startReason && (
              <p className="mt-1 text-sm font-semibold text-cleaning">{startReason}</p>
            )}
          </label>

          <label className="text-sm text-ink/70">
            Customer name
            <input
              className={fieldCls}
              placeholder="Full name"
              value={name}
              required
              onChange={(e) => setName(e.target.value.replace(/[\p{N}\d]/gu, ''))}
            />
          </label>

          <label className="text-sm text-ink/70">
            Phone number
            <input
              type="tel"
              inputMode="numeric"
              minLength={10}
              maxLength={15}
              pattern="[0-9]{10,15}"
              required
              className={fieldCls}
              placeholder="Mobile number"
              value={phone}
              onChange={(e) => setPhone(digitsOnly(e.target.value))}
            />
          </label>

          <label className="text-sm text-ink/70">
            Number of days
            <select
              className={fieldCls}
              value={nights}
              onChange={(e) => setNights(Number(e.target.value))}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={5}>5</option>
              <option value={6}>6</option>
              <option value={7}>7</option>
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving || !chosenId || !!startReason}
              className="rounded-sm bg-booked px-4 py-2.5 text-sm font-semibold text-white shadow-[0_2px_3px_rgba(0,0,0,0.35)] disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add booking'}
            </button>
          </div>
        </form>
        {msg && <p className={`mt-4 text-sm ${msg.ok ? 'text-ink' : 'text-cleaning'}`}>{msg.text}</p>}
      </section>
    </div>
  )
}