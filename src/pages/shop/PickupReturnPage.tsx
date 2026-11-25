import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { Booking, Shop } from '../../lib/shop'
import { addDays, branchName, clash, DEFAULT_RETURN_GRACE_DAYS, diffDays, fmt, inBranch, norm, peso, returnDeadline, today } from '../../lib/shop'
import { btn, btn2, input, Sub } from '../../lib/ui'

type B = Booking & {
  extension_requested?: boolean | null
  deposit_received?: boolean | null
  payment_method?: string | null
}
type Piece = { name: string; price: number }

// Pieces come from the item's Inclusions: "Gown, Petticoat" or "Gown:500, Petticoat:500".
// Without a price, the item's replacement price is split evenly across the pieces.
function piecesOf(b: B): Piece[] {
  const raw = (b.items?.inclusions ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const names = raw.length ? raw : [b.items?.name ?? 'Item']
  const total = (b.items as unknown as { replacement_price?: number | null })?.replacement_price ?? 0
  const each = Math.round(total / names.length)
  return names.map((s) => {
    const [n, p] = s.split(':')
    return { name: n.trim(), price: Number(p) || each }
  })
}

export default function PickupReturnPage({ shop, branch }: { shop: Shop; branch: string }) {
  const [id, setId] = useState('')
  const list = (shop.bookings as B[])
    .filter((b) => ['reserved', 'out'].includes(norm(b.status)) && inBranch(branch, branchName(b)))
    .sort((a, b) =>
      (norm(a.status) === 'out' ? 0 : 1) - (norm(b.status) === 'out' ? 0 : 1) || a.start_date.localeCompare(b.start_date))
  const cur = list.find((b) => b.id === id) ?? list[0]

  return (
    <div>
      <Sub>Pick a booking, then tick each piece you hand over or receive.</Sub>
      <label className="mb-5 block max-w-2xl text-sm text-ink/70">
        Booking
        <select className={`${input} mt-1 py-3`} value={cur?.id ?? ''} onChange={(e) => setId(e.target.value)}>
          {list.map((b) => (
            <option key={b.id} value={b.id}>
              {b.items?.name} · {b.customer_name} · {norm(b.status) === 'out' ? `Return by ${fmt(returnDeadline(b.end_date, b.return_grace_days ?? DEFAULT_RETURN_GRACE_DAYS))}` : `Pickup ${fmt(b.start_date)}`}
            </option>
          ))}
        </select>
      </label>
      {cur ? <Checklist key={cur.id} shop={shop} b={cur} /> : <p className="text-sm text-ink/60">Nothing to hand over or receive.</p>}
    </div>
  )
}

function Checklist({ shop, b }: { shop: Shop; b: B }) {
  const out = norm(b.status) === 'out'
  const ps = piecesOf(b)
  const fee = b.items?.late_fee_per_day ?? 0
  const deposit = b.items?.deposit ?? b.deposit_amount ?? 0
  const deadline = returnDeadline(b.end_date, b.return_grace_days ?? DEFAULT_RETURN_GRACE_DAYS)

  const [ticked, setTicked] = useState<Record<string, boolean>>({})
  const [late, setLate] = useState(Math.max(0, diffDays(deadline, today())))
  const [cond, setCond] = useState('Good')
  const [paid, setPaid] = useState(!!b.deposit_received || !!b.payment_ref)
  const [method, setMethod] = useState(b.payment_method ?? (b.payment_ref ? 'GCash' : 'Cash'))
  const [lateFeePerDay, setLateFeePerDay] = useState(fee)
  const [lateAdjustment, setLateAdjustment] = useState<'none' | 'waive' | 'percent' | 'peso'>('none')
  const [lateAdjustmentValue, setLateAdjustmentValue] = useState(0)
  const [msg, setMsg] = useState('')

  const missing = ps.filter((p) => !ticked[p.name])
  const missingFee = missing.reduce((s, p) => s + p.price, 0)
  const baseLateFee = late * lateFeePerDay
  const lateFee = lateAdjustment === 'waive'
    ? 0
    : lateAdjustment === 'percent'
      ? Math.round(baseLateFee * (1 - Math.max(0, lateAdjustmentValue) / 100))
      : lateAdjustment === 'peso'
        ? Math.max(0, baseLateFee - Math.max(0, lateAdjustmentValue))
        : baseLateFee
  const refund = Math.max(0, deposit - missingFee - lateFee)
  const update = (patch: object) => shop.act(supabase.from('bookings').update(patch).eq('id', b.id))
  const lateEndDate = addDays(deadline, late)
  const buffer = b.buffer_days ?? b.items?.buffer_days ?? 0
  const nextRisk = out
    ? shop.bookings.find((other) =>
      other.id !== b.id &&
      other.item_id === b.item_id &&
      !['cancelled', 'canceled', 'declined'].includes(norm(other.status)) &&
      addDays(lateEndDate, other.buffer_days ?? other.items?.buffer_days ?? buffer) >= other.start_date &&
      other.start_date > deadline
    )
    : undefined

  const handOver = () =>
    update({ status: 'out', deposit_received: true, deposit_amount: deposit, payment_method: method })

  const complete = () =>
    update({
      status: 'returned', days_late: late, late_fee_waived: lateAdjustment === 'waive', late_fee: lateFee,
      late_fee_note: [
        missing.length ? `Missing: ${missing.map((p) => p.name).join(', ')} (${peso(missingFee)})` : '',
        lateAdjustment !== 'none' ? `Late fee adjustment: ${lateAdjustment === 'waive' ? 'Waived' : `${peso(lateAdjustmentValue)}${lateAdjustment === 'percent' ? '%' : ''} discount`}` : '',
        cond !== 'Good' ? `Condition: ${cond}` : '',
      ].filter(Boolean).join('. ') || null,
    })

  const extend = async () => {
    const next = { ...b, end_date: addDays(b.end_date, 1) }
    if (clash(next, shop.bookings)) {
      setMsg('Cannot extend: another booking or its cleaning days start right after.')
      return
    }
    setMsg('')
    await update({ end_date: next.end_date, extension_requested: false })
  }

  return (
    <section className="mb-8 rounded-sm bg-white px-8 py-6 shadow-md">
      <h2 className="text-2xl font-bold">{out ? 'Return Checklist' : 'Pickup Checklist'}</h2>
      <p className="mb-5 mt-1 text-sm text-ink/70">
        {b.items?.name} for         <b>{b.customer_name}</b>.<br />Tick each piece you hand over or receive.
      </p>
      {out && (
        <p className="mb-5 text-sm font-semibold text-ink/70">
          Return no later than {fmt(deadline)}. Late fees begin after this date.
        </p>
      )}
      {b.extension_requested && (
        <p className="mb-4 text-base font-semibold">Customer asked for 1 more rental day (new return deadline {fmt(returnDeadline(addDays(b.end_date, 1), b.return_grace_days ?? DEFAULT_RETURN_GRACE_DAYS))}).</p>
      )}

      <ul className="mb-5">
        {ps.map((p) => (
          <li key={p.name} className="flex items-center justify-between border-t border-ink/15 py-4 first:border-t-0">
            <label className="flex cursor-pointer items-center gap-4 font-medium">
              <input type="checkbox" className="h-5 w-5 accent-booked" checked={!!ticked[p.name]}
                onChange={(e) => setTicked({ ...ticked, [p.name]: e.target.checked })} />
              {p.name}
            </label>
            <span className="text-base text-ink/70">Replace {peso(p.price)}</span>
          </li>
        ))}
      </ul>

      {out ? (
        <>
          <div className="mb-5 grid grid-cols-2 gap-10">
            <label className="text-base text-ink/70">Days Late (after {fmt(deadline)})
              <select className={`${input} mt-1 py-3`} value={late} onChange={(e) => setLate(+e.target.value)}>
                {Array.from(new Set([...Array(15).keys(), late])).sort((x, y) => x - y).map((n) => <option key={n}>{n}</option>)}
              </select>
            </label>
          <label className="text-base text-ink/70">Condition
            <select
              className={`${input} mt-1 py-3`} value={cond}onChange={(e) => setCond(e.target.value)}>
              {['Good', 'Needs cleaning', 'Needs repair', 'Damaged'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          </div>
          <div className="mb-5 grid grid-cols-2 gap-10">
          <label className="text-base text-ink/70">Late fee per day (₱)
            <input
              type="number"
              min={0}
              className={`${input} mt-1 py-3 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
              value={lateFeePerDay}
              onChange={(e) => setLateFeePerDay(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
            <label className="text-base text-ink/70">Late fee adjustment
              <select className={`${input} mt-1 py-3`} value={lateAdjustment} onChange={(e) => {
                setLateAdjustment(e.target.value as 'none' | 'waive' | 'percent' | 'peso')
                setLateAdjustmentValue(0)
              }}>
                <option value="none">None</option>
                <option value="waive">Waive late fee</option>
                <option value="percent">Discount (%)</option>
                <option value="peso">Discount (₱)</option>
              </select>
            </label>
          </div>
            {(lateAdjustment === 'percent' || lateAdjustment === 'peso') && (
                        <label className="mb-5 block max-w-sm text-base text-ink/70">
                          {lateAdjustment === 'percent' ? 'Discount percentage' : 'Discount amount'}
                          <input
                            type="number"
                            min={0}
                            max={lateAdjustment === 'percent' ? 100 : undefined}
                            className={`${input} mt-1 py-3 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                            value={lateAdjustmentValue}
                            onChange={(e) => setLateAdjustmentValue(Math.max(0, Number(e.target.value) || 0))}
                          />
                        </label>
                      )}
          {late > 0 && nextRisk && (
            <p className="mb-5 rounded-sm border border-cleaning/30 bg-cleaning/10 px-4 py-3 text-sm font-semibold text-cleaning">
              Late return puts the next pickup at risk: {nextRisk.customer_name ?? 'A customer'} is due to pick up
              {' '}{fmt(nextRisk.start_date)}. The item will be available only after a {buffer}-day cleaning buffer.
            </p>
          )}
          <div className="mb-5 space-y-1 border-t border-ink/15 pt-4 text-base">
            <div className="flex justify-between"><span>Missing: {missing.length ? missing.map((p) => p.name).join(', ') : 'None'}</span><span>{peso(missingFee)}</span></div>
            <div className="flex items-center justify-between">
              <span>Late fee ({late} × {peso(lateFeePerDay)})</span>
              <span>{peso(lateFee)}</span>
            </div>
            <div className="flex justify-between"><span>Deposit {peso(deposit)}, refund</span><b className="text-green-800">{peso(refund)}</b></div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className={btn} onClick={complete}>Complete Return</button>
            <button className={btn2} onClick={extend}>Extend 1 day</button>
          </div>
        </>
      ) : (
        <>
          <div className="mb-5 flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-4 font-semibold">
              <input type="checkbox" className="h-5 w-5 accent-booked" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
              Deposit {peso(deposit)} received
            </label>
            <select className={`${input} w-40 py-3`} value={method} onChange={(e) => setMethod(e.target.value)}>
              {['Cash', 'GCash', 'Maya', 'Bank transfer'].map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          {b.payment_ref && <p className="mb-4 text-sm text-ink/60">Paid online, ref {b.payment_ref}.</p>}
          <button className={btn} disabled={!paid || missing.length > 0} onClick={handOver}>Hand over, mark out</button>
        </>
      )}
      {msg && <p className="mt-3 text-base text-cleaning">{msg}</p>}
    </section>
  )
}