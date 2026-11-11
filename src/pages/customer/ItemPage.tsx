import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ChevronLeft } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import type { CBranch, CItem, CShop } from '../../lib/customer'
import { longDate } from '../../lib/customer'
import { addDays, peso, today } from '../../lib/shop'

const box = 'mt-1 w-full rounded-sm border border-ink/25 bg-white px-2 py-1.5 text-xs text-ink'

export default function ItemPage({
  item, branches, shop, session, onBack, onNeedAuth, onSent,
}: {
  item: CItem; branches: CBranch[]; shop?: CShop; session: Session | null
  onBack: () => void; onNeedAuth: () => void; onSent: (start: string, end: string) => void
}) {
  const [offset, setOffset] = useState(0)
  const [days, setDays] = useState(1)
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [ret, setRet] = useState(item.branch_id ?? '')
  const [method, setMethod] = useState('GCash')
  const [ref, setRef] = useState('')
  const [avail, setAvail] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const start = addDays(today(), offset)
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
    supabase.rpc('item_available', { p_item: item.id, p_start: start, p_end: end }).then(({ data, error }) => {
      if (error) setErr(error.message)
      else setAvail(!!data)
    })
  }, [item.id, start, end])

  async function reserve() {
    if (!session) return onNeedAuth()
    if (!phone.trim() || !ref.trim()) return setErr('Enter your mobile number and the payment reference no.')
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
    if (error) setErr(error.message)
    else onSent(start, end)
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <button onClick={onBack} className="mb-6 flex items-center gap-1 text-sm"><ChevronLeft size={16} /> Back to catalog</button>
      <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
        <div className="aspect-[3/4] bg-white shadow-sm">
          {item.image_url && <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />}
        </div>
        <div className="rounded-sm bg-white p-6 text-xs shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-base font-bold">{item.name}</h1>
              <p>{item.category}</p>
              {multi && <p className="mt-3">Pickup at <b>{item.branches?.name} Branch</b></p>}
              <div className="mt-3 flex flex-wrap gap-1">
                {pieces.map((p) => <span key={p} className="rounded-sm bg-reserved px-2 py-0.5 text-[9px] font-semibold">{p}</span>)}
              </div>
            </div>
            {sizeLines.length > 0 && (
              <div className="w-44 shrink-0 space-y-1 rounded-sm border border-ink/20 p-3 text-[10px]">
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
            <label className="text-[10px] text-ink/70">Pickup day
              <select className={box} value={offset} onChange={(e) => setOffset(+e.target.value)}>
                {Array.from({ length: 14 }, (_, n) => <option key={n} value={n}>{longDate(addDays(today(), n))}</option>)}
              </select>
            </label>
            <label className="text-[10px] text-ink/70">Day/s
              <select className={box} value={days} onChange={(e) => setDays(+e.target.value)}>
                {[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}
              </select>
            </label>
            <label className="text-[10px] text-ink/70">Mobile Number
              <input className={box} placeholder="09## #### ###" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label className="text-[10px] text-ink/70">Note to shop (optional)
              <input className={box} maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            {multi && (
              <label className="text-[10px] text-ink/70">Return at
                <select className={box} value={ret} onChange={(e) => setRet(e.target.value)}>
                  {shopBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
            )}
          </div>
          <p className="mt-3 text-xs">
            {avail === null ? 'Checking dates...'
              : avail ? <><b className="font-semibold text-green-700">Available.</b> Return by {longDate(end)}.</>
              : <><b className="font-semibold text-red-600">Not available</b> for those dates. Try another day.</>}
          </p>
          <p className="mt-2 text-[10px] text-ink/50">
            Deposit {peso(deposit)}. Late return: {peso(item.late_fee_per_day ?? 0)} per day. Missing pieces are charged from the deposit.
          </p>

          <div className="mt-4 rounded-sm bg-reserved/40 p-4">
            <h3 className="mb-1 text-sm font-semibold">Pay the gown and deposit online ({peso(price * days)} + {peso(deposit)})</h3>
            <p className="mb-3 text-[10px]">Online payments only: e-wallet or bank transfer.</p>
            <div className="grid grid-cols-2 gap-4">
              <label className="text-[10px] text-ink/70">Payment method
                <select className={box} value={method} onChange={(e) => setMethod(e.target.value)}>
                  {['GCash', 'Maya', 'Bank transfer'].map((m) => <option key={m}>{m}</option>)}
                </select>
              </label>
              <label className="text-[10px] text-ink/70">Reference no.
                <input className={box} placeholder="Transaction / reference no." value={ref} onChange={(e) => setRef(e.target.value)} />
              </label>
            </div>
            {shop?.pay_number && <p className="mt-3 text-[10px]">Send to {shop.pay_number}{shop.pay_name ? ` (${shop.pay_name})` : ''}</p>}
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
      <button onClick={onBack} className="mb-8 flex items-center gap-1 text-sm"><ChevronLeft size={16} /> Back to catalog</button>
      <div className="mx-auto max-w-md rounded-sm bg-white p-6 text-xs shadow-md">
        <h1 className="mb-3 text-base font-bold">Request Sent</h1>
        <p className="mb-4">The shop will confirm your reservation of <b>{item.name}</b>.</p>
        {row('Pickup', longDate(start))}
        {row('Return by', longDate(end))}
        {row('Deposit', peso(item.deposit ?? 0))}
        {row('Late fee', `${peso(item.late_fee_per_day ?? 0)}/day`)}
        <p className="my-4 text-[10px] text-ink/50">You'll get a reminder the day before your return date.</p>
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
