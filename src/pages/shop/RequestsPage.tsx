import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { Shop } from '../../lib/shop'
import { branchName, clash, fmt, inBranch, nights, norm, peso, rental } from '../../lib/shop'
import { btn, btn2, card, Field, input, Sub, Tag } from '../../lib/ui'

const REASONS = [
  'Dates are no longer available',
  'Item needs cleaning or repair',
  'Item is no longer offered',
  'Please contact the shop for details',
]

export default function RequestsPage({ shop, branch }: { shop: Shop; branch: string }) {
  const [reason, setReason] = useState<Record<string, string>>({})
  const list = shop.bookings.filter((b) => norm(b.status) === 'pending' && inBranch(branch, branchName(b)))
  const update = (id: string, patch: object) => shop.act(supabase.from('bookings').update(patch).eq('id', id))

  return (
    <div>
      <Sub>Requests sent from the customer site land here. Confirm to reserve the dates, or decline.</Sub>
      {list.length === 0 && <p className="text-sm text-ink/60">No new requests.</p>}
      {list.map((b) => {
        const x = b.items
        const c = clash(b, shop.bookings)
        const n = nights(b)
        return (
          <section key={b.id} className={card}>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">{x?.name}</h3>
              <Tag>{branchName(b)}</Tag>
              <Tag>New Request</Tag>
            </div>
            <p className="mb-5 text-xs">{x?.category}</p>
            <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field l="Customer" v={b.customer_name} />
              <Field l="Phone" v={b.customer_phone ?? '-'} />
              <Field l="Pickup" v={`${fmt(b.start_date)} at ${branchName(b)}`} />
              <Field l="Return by" v={`${fmt(b.end_date)} at ${branchName(b)}`} />
              <Field l="Rental Length" v={`${n} day${n > 1 ? 's' : ''}`} />
              <Field l="Rental" v={peso(rental(b))} />
              <Field l="Transfer fee" v="None" />
              <Field l="Total rental" v={peso(rental(b))} />
              <Field l="Deposit at pickup" v={peso(x?.deposit ?? 0)} />
              <Field l="Late fee" v={`${peso(x?.late_fee_per_day ?? 0)}/day`} />
            </div>
            {b.note && (
              <div className="mb-4">
                <div className="mb-1 text-[10px] text-ink/60">Note from customer</div>
                <div className="rounded-sm border border-ink/25 px-3 py-2 text-xs">{b.note}</div>
              </div>
            )}
            <div className="mb-4 text-xs leading-relaxed">
              {c ? (
                <p className="font-bold text-cleaning">
                  Dates are not available. They overlap {c.customer_name}'s booking or its cleaning days.
                </p>
              ) : (
                <p><b className="text-green-800">Dates are free</b> including cleaning buffer.</p>
              )}
              {b.payment_ref && (
                <p><b>Deposit paid online:</b> {peso(b.deposit_amount ?? 0)}, <b>ref {b.payment_ref}</b>. Check it in your account before confirming.</p>
              )}
              <p>Remind them to bring a valid ID.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button className={btn} disabled={!!c} onClick={() => update(b.id, { status: 'reserved' })}>Confirm</button>
              <button
                className={btn2}
                onClick={() => update(b.id, { status: 'cancelled', decline_reason: reason[b.id] ?? REASONS[0] })}
              >
                Decline
              </button>
              <select
                className={`${input} w-64`}
                value={reason[b.id] ?? REASONS[0]}
                onChange={(e) => setReason({ ...reason, [b.id]: e.target.value })}
              >
                {REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
          </section>
        )
      })}
    </div>
  )
}
