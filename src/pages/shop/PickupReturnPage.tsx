import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { Booking, Shop } from '../../lib/shop'
import { addDays, branchName, clash, diffDays, fmt, inBranch, norm, peso, today } from '../../lib/shop'
import { btn, btn2, card, input, Sub } from '../../lib/ui'

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
      <label className="mb-5 block max-w-xl text-[11px] text-ink/70">
        Booking
        <select className={`${input} mt-1 py-2.5`} value={cur?.id ?? ''} onChange={(e) => setId(e.target.value)}>
          {list.map((b) => (
            <option key={b.id} value={b.id}>
              {b.items?.name} · {b.customer_name} · {norm(b.status) === 'out' ? `Return ${fmt(b.end_date)}` : `Pickup ${fmt(b.start_date)}`}
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

  const [ticked, setTicked] = useState<Record<string, boolean>>({})
  const [late, setLate] = useState(Math.max(0, diffDays(b.end_date, today())))
  const [cond, setCond] = useState('Good')
  const [paid, setPaid] = useState(!!b.deposit_received || !!b.payment_ref)
  const [method, setMethod] = useState(b.payment_method ?? (b.payment_ref ? 'GCash' : 'Cash'))
  const [waive, setWaive] = useState(false)
  const [msg, setMsg] = useState('')

  const missing = ps.filter((p) => !ticked[p.name])
  const missingFee = missing.reduce((s, p) => s + p.price, 0)
  const lateFee = waive ? 0 : late * fee
  const refund = Math.max(0, deposit - missingFee - lateFee)
  const update = (patch: object) => shop.act(supabase.from('bookings').update(patch).eq('id', b.id))

  const handOver = () =>
    update({ status: 'out', deposit_received: true, deposit_amount: deposit, payment_method: method })

  const complete = () =>
    update({
      status: 'returned', days_late: late, late_fee_waived: waive, late_fee: lateFee + missingFee,
      late_fee_note: [
        missing.length ? `Missing: ${missing.map((p) => p.name).join(', ')} (${peso(missingFee)})` : '',
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
    <section className={`${card} max-w-3xl`}>
      <h2 className="text-lg font-semibold">{out ? 'Return Checklist' : 'Pickup Checklist'}</h2>
      <p className="mb-5 mt-1 text-[10px] text-ink/70">
        {b.items?.name} for <b>{b.customer_name}</b>.<br />Tick each piece you hand over or receive.
      </p>
      {b.extension_requested && (
        <p className="mb-4 text-xs font-semibold">Customer asked for 1 more day (until {fmt(addDays(b.end_date, 1))}).</p>
      )}

      <ul className="mb-5 border-b border-ink/15">
        {ps.map((p) => (
          <li key={p.name} className="flex items-center justify-between border-t border-ink/15 py-3 first:border-t-0">
            <label className="flex cursor-pointer items-center gap-4 font-medium">
              <input type="checkbox" className="h-4 w-4 accent-booked" checked={!!ticked[p.name]}
                onChange={(e) => setTicked({ ...ticked, [p.name]: e.target.checked })} />
              {p.name}
            </label>
            <span className="text-[11px] text-ink/70">Replace {peso(p.price)}</span>
          </li>
        ))}
      </ul>

      {out ? (
        <>
          <div className="mb-5 grid grid-cols-2 gap-8">
            <label className="text-[11px] text-ink/70">Days Late
              <select className={`${input} mt-1 py-2.5`} value={late} onChange={(e) => setLate(+e.target.value)}>
                {Array.from(new Set([...Array(15).keys(), late])).sort((x, y) => x - y).map((n) => <option key={n}>{n}</option>)}
              </select>
            </label>
            <label className="text-[11px] text-ink/70">Condition
              <select className={`${input} mt-1 py-2.5`} value={cond} onChange={(e) => setCond(e.target.value)}>
                {['Good', 'Needs cleaning', 'Needs repair', 'Damaged'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <div className="mb-5 space-y-1 border-t border-ink/15 pt-4 text-xs">
            <div className="flex justify-between"><span>Missing: {missing.length ? missing.map((p) => p.name).join(', ') : 'None'}</span><span>{peso(missingFee)}</span></div>
            <div className="flex items-center justify-between">
              <span>Late fee ({late} × {peso(fee)})
                <label className="ml-3 text-[10px] text-ink/60"><input type="checkbox" className="mr-1 accent-booked" checked={waive} onChange={(e) => setWaive(e.target.checked)} />Waive</label>
              </span>
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
              <input type="checkbox" className="h-4 w-4 accent-booked" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
              Deposit {peso(deposit)} received
            </label>
            <select className={`${input} w-32 py-2`} value={method} onChange={(e) => setMethod(e.target.value)}>
              {['Cash', 'GCash', 'Maya', 'Bank transfer'].map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          {b.payment_ref && <p className="mb-4 text-[10px] text-ink/60">Paid online, ref {b.payment_ref}.</p>}
          <button className={btn} disabled={!paid || missing.length > 0} onClick={handOver}>Hand over, mark out</button>
        </>
      )}
      {msg && <p className="mt-3 text-xs text-cleaning">{msg}</p>}
    </section>
  )
}