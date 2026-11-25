import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { Shop } from '../../lib/shop'
import { branchName, clash, DEFAULT_RETURN_GRACE_DAYS, fmt, inBranch, nights, norm, peso, rental, returnDeadline } from '../../lib/shop'
import { btn, btn2, card, Field, input, Sub, Tag } from '../../lib/ui'

const REASONS = [
  'Dates are no longer available',
  'Item needs cleaning or repair',
  'Item is no longer offered',
  'Please contact the shop for details',
]

export default function RequestsPage({ shop, branch }: { shop: Shop; branch: string }) {
  const [reason, setReason] = useState<Record<string, string>>({})
  const [requestError, setRequestError] = useState('')
  const [updatingId, setUpdatingId] = useState('')
  const list = shop.bookings.filter((b) => norm(b.status) === 'pending' && inBranch(branch, branchName(b)))
  const reload = shop.reload

  useEffect(() => {
    const timer = setInterval(() => { void reload() }, 8000)
    return () => clearInterval(timer)
  }, [reload])

  async function updateRequest(id: string, patch: object) {
    if (updatingId) return
    setUpdatingId(id)
    setRequestError('')
    try {
      const { data, error } = await supabase.from('bookings')
        .update(patch).eq('id', id).eq('status', 'pending').select('id')
      if (error) {
        setRequestError(error.message)
      } else if (!data?.length) {
        setRequestError('This request was already cancelled or updated.')
      }
      await reload()
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Could not update this request.')
    } finally {
      setUpdatingId('')
    }
  }

  return (
    <div>
      {requestError && <p role="alert" className="mb-3 text-sm text-cleaning">{requestError}</p>}
      <Sub>Requests sent from the customer site land here. Confirm to reserve the dates, or decline.</Sub>
      {list.length === 0 && <p className="text-sm text-ink/60">No new requests.</p>}
      {list.map((b) => {
        const x = b.items
        const c = clash(b, shop.bookings)
        const n = nights(b)
        return (
          <section key={b.id} className={card}>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-bold">{x?.name}</h3>
              <Tag>{branchName(b)}</Tag>
              <Tag>New Request</Tag>
            </div>
            <p className="mb-5 text-sm">{x?.category}</p>
            <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field l="Customer" v={b.customer_name} />
              <Field l="Phone" v={b.customer_phone ?? '-'} />
              <Field l="Pickup" v={`${fmt(b.start_date)} at ${branchName(b)}`} />
              <Field l="Rental period ends" v={fmt(b.end_date)} />
              <Field l="Return no later than" v={`${fmt(returnDeadline(b.end_date, b.return_grace_days ?? DEFAULT_RETURN_GRACE_DAYS))} at ${branchName(b)}`} />
              <Field l="Rental Length" v={`${n} day${n > 1 ? 's' : ''}`} />
              <Field l="Rental" v={peso(rental(b))} />
              <Field l="Transfer fee" v="None" />
              <Field l="Total rental" v={peso(rental(b))} />
              <Field l="Deposit at pickup" v={peso(x?.deposit ?? 0)} />
              <Field l="Late fee after grace period" v={`${peso(x?.late_fee_per_day ?? 0)}/day`} />
            </div>
            {b.note && (
              <div className="mb-4">
                <div className="mb-1 text-sm text-ink/60">Note from customer</div>
                <div className="rounded-sm border border-ink/25 px-3 py-2 text-sm">{b.note}</div>
              </div>
            )}
            <div className="mb-4 text-sm leading-relaxed">
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
              <button className={btn} disabled={!!c || !!updatingId} onClick={() => updateRequest(b.id, { status: 'reserved' })}>
                {updatingId === b.id ? 'Updating…' : 'Confirm'}
              </button>
              <button
                className={btn2}
                disabled={!!updatingId}
                onClick={() => updateRequest(b.id, { status: 'cancelled', decline_reason: reason[b.id] ?? REASONS[0] })}
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
