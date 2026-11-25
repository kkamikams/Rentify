import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import type { CBranch, CItem, CShop } from '../../lib/customer'
import { itemImages, longDate } from '../../lib/customer'
import { addDays, DEFAULT_RETURN_GRACE_DAYS, peso, returnDeadline, today } from '../../lib/shop'
import { digitsOnly, isValidPhone } from '../../lib/name'

const box = 'mt-1 w-full rounded-sm border border-ink/25 bg-white px-2 py-1.5 text-sm text-ink'

export default function ItemPage({
  item, branches, shop, session, onBack, onNeedAuth, onSent,
}: {
  item: CItem; branches: CBranch[]; shop?: CShop; session: Session | null
  onBack: () => void; onNeedAuth: () => void; onSent: (start: string, end: string) => void
}) {
  const [start, setStart] = useState(today)
  const [days, setDays] = useState(1)
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [ret, setRet] = useState(item.branch_id ?? '')
  const [method, setMethod] = useState('GCash')
  const [ref, setRef] = useState('')
  const [avail, setAvail] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [blockReason, setBlockReason] = useState('')
  const images = itemImages(item)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)

  const end = addDays(start, days - 1)
  const price = item.price_per_day ?? 0
  const deposit = item.deposit ?? 0
  const pieces = (item.inclusions ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const sizeLines = ((item as CItem & { size_info?: string | null }).size_info ?? '')
    .split('\n').map((s) => s.trim()).filter(Boolean)

  // Branch choices only matter when the shop has more than one branch
  const shopBranches = branches.filter((b) => b.shop_id === item.shop_id)
  const multi = shopBranches.length > 1

  useEffect(() => {
    setAvail(null)
    setBlockReason('')
    if (!start) return
    ;(async () => {
      const buffer = item.buffer_days ?? 0
      const { data: bookings, error: clashError } = await supabase
        .from('bookings')
        .select('id, start_date, end_date, buffer_days, return_grace_days, status')
        .eq('item_id', item.id)
        .neq('status', 'cancelled')
        .neq('status', 'canceled')
        .neq('status', 'declined')

      if (clashError) {
        setErr(clashError.message)
        setAvail(null)
        return
      }

      const requestedStart = addDays(start, -buffer)
      const requestedEnd = addDays(end, DEFAULT_RETURN_GRACE_DAYS + buffer)
      const clash = bookings?.find((booking) => {
        const existingBuffer = booking.buffer_days ?? buffer
        const existingStart = addDays(booking.start_date, -existingBuffer)
        const existingEnd = addDays(
          booking.end_date,
          (booking.return_grace_days ?? DEFAULT_RETURN_GRACE_DAYS) + existingBuffer
        )
        return requestedStart <= existingEnd && existingStart <= requestedEnd
      })

      if (clash) {
        setAvail(false)
        setBlockReason('These dates overlap an existing booking, its return grace period, or cleaning buffer.')
        return
      }

      const { data: rpcAvailable, error: rpcError } = await supabase.rpc(
        'item_available',
        { p_item: item.id, p_start: start, p_end: end }
      )
      if (rpcError) {
        setErr(rpcError.message)
        setAvail(null)
      } else {
        setAvail(!!rpcAvailable)
      }
    })()
  }, [item.id, start, end])

  async function reserve() {
    if (!session) return onNeedAuth()
    if (!phone.trim() || !ref.trim()) return setErr('Enter your mobile number and the payment reference no.')
    if (!isValidPhone(phone)) return setErr('Enter your mobile number using 10 to 15 digits.')
    if (avail === false) {
      setErr(blockReason || 'Those dates are not available. Pick other dates.')
      return
    }
    setBusy(true)
    setErr('')
    const { data: ok } = await supabase.rpc('item_available', { p_item: item.id, p_start: start, p_end: end })
    if (!ok) { setErr('Those dates are not available. Pick other dates.'); setBusy(false); return }

    const meta = session.user.user_metadata as { full_name?: string }
    const { error } = await supabase.from('bookings').insert({
      shop_id: item.shop_id, item_id: item.id, customer_id: session.user.id,
      customer_name: meta.full_name ?? session.user.email?.split('@')[0] ?? 'Customer',
      customer_phone: phone.trim(), note: note.trim() || null,
      start_date: start, end_date: end, buffer_days: item.buffer_days,
      status: 'pending', deposit_amount: deposit, payment_method: method, payment_ref: ref.trim(),
      return_branch_id: ret || null,
    })
    setBusy(false)
    if (error) setErr(error.message.includes('DATES_UNAVAILABLE')
      ? 'Those dates are no longer available. Pick other dates.'
      : error.message)
    else onSent(start, end)
  }

  return (
    <div className="mx-auto max-w-6xl px-2 py-5">
      <button onClick={onBack} className="mb-5 flex items-center gap-1 text-sm"><ChevronLeft size={30} /> Back</button>
      <div className="grid gap-6 md:grid-cols-[1.15fr_1.85fr]">
        <div>
          <div
            className="relative aspect-[3/4] touch-pan-y overflow-hidden bg-white shadow-sm"
            onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX ?? null)}
            onTouchEnd={(event) => {
              if (touchStartX === null || images.length < 2) return
              const endX = event.changedTouches[0]?.clientX ?? touchStartX
              const distance = touchStartX - endX
              if (Math.abs(distance) > 45) {
                const nextIndex = (photoIndex + (distance > 0 ? 1 : -1) + images.length) % images.length
                setPhotoIndex(nextIndex)
              }
              setTouchStartX(null)
            }}
          >
            <div
              className="flex h-full transition-transform duration-500 ease-out"
              style={{ width: `${images.length * 100}%`, transform: `translateX(-${photoIndex * (100 / images.length)}%)` }}
            >
              {images.map((image, index) => (
                <div key={image} className="h-full shrink-0" style={{ width: `${100 / images.length}%` }}>
                  <img src={image} alt={`${item.name} photo ${index + 1}`} className="h-full w-full object-cover" draggable={false} />
                </div>
              ))}
            </div>
            {images.length > 1 && (
              <>
                <button type="button" aria-label="Previous photo" onClick={() => setPhotoIndex((photoIndex - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow"><ChevronLeft size={18} /></button>
                <button type="button" aria-label="Next photo" onClick={() => setPhotoIndex((photoIndex + 1) % images.length)} className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow"><ChevronRight size={18} /></button>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {images.map((image, index) => (
                <button key={image} type="button" onClick={() => setPhotoIndex(index)} className={`aspect-square overflow-hidden border-2 ${photoIndex === index ? 'border-ink' : 'border-transparent'}`}>
                  <img src={image} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-sm bg-white p-6 text-sm shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold">{item.name}</h1>
              <p>{item.category}</p>
              {multi && <p className="mt-3">Pickup at <b>{item.branches?.name} Branch</b></p>}
              <div className="mt-3 flex flex-wrap gap-1">
                {pieces.map((p) => <span key={p} className="rounded-sm bg-reserved px-2 py-0.5 text-sm font-semibold">{p}</span>)}
              </div>
            </div>
            {sizeLines.length > 0 && (
              <div className="w-44 shrink-0 space-y-1 rounded-sm border border-ink/20 p-3 text-sm">
                {sizeLines.map((line) => {
                  const [l, ...rest] = line.split(':')
                  return rest.length
                    ? <p key={line}><b>{l}:</b> {rest.join(':').trim()}</p>
                    : <p key={line}>{line}</p>
                })}
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
            <label className="text-sm text-ink/70">Pickup day
              <input
                type="date"
                className={box}
                value={start}
                min={today()}
                max={addDays(today(), 13)}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label className="text-sm text-ink/70">Day/s
              <select className={box} value={days} onChange={(e) => setDays(+e.target.value)}>
                {[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}
              </select>
            </label>
            <label className="text-sm text-ink/70">Mobile Number
              <input type="tel" inputMode="numeric" minLength={10} maxLength={15} pattern="[0-9]{10,15}" required className={box} placeholder="Mobile number" value={phone} onChange={(e) => setPhone(digitsOnly(e.target.value))} />
            </label>
            <label className="text-sm text-ink/70">Note to shop (optional)
              <input className={box} maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            {multi && (
              <label className="text-sm text-ink/70">Return at
                <select className={box} value={ret} onChange={(e) => setRet(e.target.value)}>
                  {shopBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
            )}
          </div>
          <p className="mt-3 text-sm">
            {avail === null ? 'Checking dates...'
              : avail ? <><b className="font-semibold text-green-700">Available.</b> Rental ends {longDate(end)}; return by {longDate(returnDeadline(end))}.</>
              : <><b className="font-semibold text-red-600">Not available</b> for those dates. {blockReason || 'Try another day.'}</>}
          </p>
          <p className="mt-2 text-sm text-ink/50">
            You have 7 days after the selected rental period ends to return the item. After {longDate(returnDeadline(end))}, late returns are {peso(item.late_fee_per_day ?? 0)} per day. Deposit {peso(deposit)}. Missing pieces are charged from the deposit.
          </p>

          <div className="mt-4 rounded-sm bg-reserved/40 p-4">
            <h3 className="mb-1 text-xl font-bold">Pay the rental and deposit online ({peso(price * days)} + {peso(deposit)})</h3>
            <p className="mb-3 text-sm">Online payments only: e-wallet or bank transfer.</p>
            <div className="grid grid-cols-2 gap-4">
              <label className="text-sm text-ink/70">Payment method
                <select className={box} value={method} onChange={(e) => setMethod(e.target.value)}>
                  {['GCash', 'Maya', 'Bank transfer'].map((m) => <option key={m}>{m}</option>)}
                </select>
              </label>
              <label className="text-sm text-ink/70">Reference no.
                <input className={box} placeholder="Transaction / reference no." value={ref} onChange={(e) => setRef(e.target.value)} />
              </label>
            </div>
            {shop?.pay_number && <p className="mt-3 text-sm">Send to {shop.pay_number}{shop.pay_name ? ` (${shop.pay_name})` : ''}</p>}
          </div>

          {err && <p className="mt-3 text-cleaning">{err}</p>}
          <button onClick={reserve} disabled={busy || avail === false}
            className="mt-4 w-full rounded-sm bg-ink py-3 text-sm font-semibold text-white shadow-[0_2px_3px_rgba(0,0,0,0.35)] disabled:opacity-50">
            {busy ? 'Sending...' : `Reserve for ${peso(price * days + deposit)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export function SentPage({
  item, start, end, onBack, onBookings,
}: { item: CItem; start: string; end: string; onBack: () => void; onBookings: () => void }) {
  const row = (l: string, v: string) => <div className="flex justify-between"><span>{l}</span><b>{v}</b></div>
  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <button onClick={onBack} className="mb-8 flex items-center gap-1 text-sm"><ChevronLeft size={16} /> Back</button>
      <div className="mx-auto max-w-md rounded-sm bg-white p-6 text-sm shadow-md">
        <h1 className="mb-3 text-xl font-bold">Request Sent</h1>
        <p className="mb-4">The shop will confirm your reservation of <b>{item.name}</b>.</p>
        {row('Pickup', longDate(start))}
        {row('Rental period ends', longDate(end))}
        {row('Return no later than', longDate(returnDeadline(end)))}
        {row('Deposit', peso(item.deposit ?? 0))}
        {row('Late fee after grace period', `${peso(item.late_fee_per_day ?? 0)}/day`)}
        <p className="my-4 text-sm text-ink/50">You have 7 days after the rental period ends to return the item. Your return deadline is {longDate(returnDeadline(end))}.</p>
        <div className="text-center">
          <button onClick={onBookings}
            className="rounded-sm bg-ink px-6 py-2.5 text-sm font-semibold text-white shadow-[0_2px_3px_rgba(0,0,0,0.35)]">
            View my bookings
          </button>
        </div>
      </div>
    </div>
  )
}
