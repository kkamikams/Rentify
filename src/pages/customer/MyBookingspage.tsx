import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { MyBooking } from '../../lib/customer'
import { STATUS_LABEL } from '../../lib/customer'
import { addDays, diffDays, fmt, norm, peso, today } from '../../lib/shop'

const btnDark = 'w-full rounded-sm bg-booked px-4 py-2 text-xs font-semibold text-white shadow-[0_2px_3px_rgba(0,0,0,0.35)]'
const btnGrey = 'w-full rounded-sm bg-cell px-4 py-2 text-xs font-semibold text-ink shadow-[0_2px_3px_rgba(0,0,0,0.2)] disabled:opacity-60'

export default function MyBookingsPage({ onMessage }: { onMessage: (branchId?: string) => void }) {
  const [list, setList] = useState<MyBooking[]>([])
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('bookings').select('*, items(*, branches(name))').order('start_date', { ascending: false })
    if (error) setErr(error.message)
    else setList((data ?? []) as unknown as MyBooking[])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const run = async (fn: 'cancel_booking' | 'request_extension', id: string) => {
    const { error } = await supabase.rpc(fn, { p_id: id })
    if (error) setErr(error.message)
    else load()
  }

  const now = today()
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="mb-5 text-base font-bold">My bookings ({list.length})</h1>
      {err && <p className="mb-3 text-sm text-cleaning">{err}</p>}
      {loading && <p className="text-sm text-ink/60">Loading...</p>}
      {!loading && list.length === 0 && <p className="text-sm text-ink/60">No bookings yet.</p>}
      {list.map((b) => {
        const st = norm(b.status)
        const x = b.items
        const fee = x?.late_fee_per_day ?? 0
        const when =
          st === 'out'
            ? b.end_date < now ? `Late by ${diffDays(b.end_date, now)} day(s). Fee so far ${peso(diffDays(b.end_date, now) * fee)}.`
              : b.end_date === now ? 'Return today.' : `${diffDays(now, b.end_date)} day(s) left.`
            : st === 'pending' || st === 'reserved'
              ? b.start_date <= now ? 'Pickup today.' : `Pickup in ${diffDays(now, b.start_date)} day(s).`
              : ''
        return (
          <section key={b.id} className="mb-5 flex flex-wrap items-center gap-5 rounded-sm bg-white p-5 shadow-sm">
            <div className="h-28 w-24 shrink-0 bg-cream">
              {x?.image_url && <img src={x.image_url} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-[220px] flex-1 space-y-1 text-[10px]">
              <div className="flex items-center gap-2 text-sm font-bold">
                {x?.name}
                <span className="rounded-sm bg-reserved px-1.5 py-0.5 text-[9px] font-semibold">{STATUS_LABEL[st] ?? st}</span>
              </div>
              <p className="text-ink/60">Pickup {fmt(b.start_date)} · Return by <b className="text-ink">{fmt(b.end_date)}</b></p>
              {when && <p>{when}</p>}
              <p className="text-ink/60">Branch: {x?.branches?.name}</p>
              {st === 'pending' && <p className="font-bold">Waiting for the shop to confirm.</p>}
              {b.extension_requested && <p className="font-bold">Extension requested until {fmt(addDays(b.end_date, 1))}. Waiting for the shop.</p>}
              {b.payment_ref && (
                <p className="font-bold">Deposit {peso(b.deposit_amount ?? 0)} paid online via {b.payment_method} (ref {b.payment_ref})</p>
              )}
              <p className="text-ink/50">
                {x?.inclusions ? `Pieces: ${x.inclusions} · ` : ''}Deposit {peso(x?.deposit ?? 0)} · Late fee {peso(fee)}/day
              </p>
            </div>
            <div className="w-44 space-y-2">
              <button className={btnDark} onClick={() => onMessage(x?.branch_id ?? undefined)}>Message {x?.branches?.name}</button>
              {(st === 'pending' || st === 'reserved') && (
                <button className={btnGrey} onClick={() => run('cancel_booking', b.id)}>Cancel booking</button>
              )}
              {st === 'out' && (
                <button className={btnGrey} disabled={b.extension_requested} onClick={() => run('request_extension', b.id)}>
                  {b.extension_requested ? 'Extension requested' : 'Request 1 more day'}
                </button>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
