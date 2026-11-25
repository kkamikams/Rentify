import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { MyBooking } from '../../lib/customer'
import { addDays, DEFAULT_RETURN_GRACE_DAYS, diffDays, fmt, norm, peso, returnDeadline, today } from '../../lib/shop'
import { longDate } from '../../lib/customer'

const btnDark = 'w-full rounded-sm bg-booked px-4 py-2 text-xs font-semibold text-white shadow-[0_2px_3px_rgba(0,0,0,0.35)]'
const pdfPeso = (amount: number) => `PHP ${Math.round(amount).toLocaleString('en-PH')}`
const TAG: Record<string, [string, string]> = {
  pending: ['Awaiting confirmation', 'bg-reserved text-ink'],
  reserved: ['Confirmed', 'bg-green-700 text-white'],
  out: ['Picked up', 'bg-booked text-white'],
  in_transit: ['Returned', 'bg-returned text-white'],
  returned: ['Returned', 'bg-returned text-white'],
  cleaning: ['Returned', 'bg-returned text-white'],
  ready: ['Returned', 'bg-returned text-white'],
  cancelled: ['Cancelled', 'bg-cell text-ink'],
}
const btnGrey = 'w-full rounded-sm bg-cell px-4 py-2 text-xs font-semibold text-ink shadow-[0_2px_3px_rgba(0,0,0,0.2)] disabled:opacity-60'

async function downloadReceiptPdf(booking: MyBooking) {
  const { jsPDF } = await import('jspdf')
  const item = booking.items
  const start = booking.quoted_start_date ?? booking.start_date
  const end = booking.quoted_end_date ?? booking.end_date
  const graceDays = booking.return_grace_days ?? DEFAULT_RETURN_GRACE_DAYS
  const rentalDays = diffDays(start, end) + 1
  const dailyRate = booking.quoted_daily_rate ?? item?.price_per_day ?? 0
  const rentalQuote = booking.quoted_rental_total ?? dailyRate * rentalDays
  const deposit = booking.quoted_deposit_amount ?? booking.deposit_amount ?? item?.deposit ?? 0
  const lateFee = booking.quoted_late_fee_per_day ?? item?.late_fee_per_day ?? 0
  const pdf = new jsPDF()
  let y = 24

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(20)
  pdf.text('Rentify Digital Booking Receipt', 18, y)
  y += 12
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.text(`Booking reference: ${booking.id}`, 18, y)
  y += 12

  const detail = (label: string, value: string) => {
    pdf.setFont('helvetica', 'bold')
    pdf.text(label, 18, y)
    y += 6
    pdf.setFont('helvetica', 'normal')
    const lines = pdf.splitTextToSize(value, 174) as string[]
    pdf.text(lines, 18, y)
    y += lines.length * 5 + 5
  }

  detail('Item', booking.quoted_item_name ?? item?.name ?? 'Rental item')
  if (item?.branches?.name) detail('Branch', item.branches.name)
  detail('Pickup', longDate(start))
  detail('Rental period ends', longDate(end))
  detail('Return no later than', longDate(returnDeadline(end, graceDays)))
  detail('Rental rate', `${pdfPeso(dailyRate)} x ${rentalDays} day(s)`)

  pdf.setDrawColor(180)
  pdf.line(18, y, 192, y)
  y += 9
  const amount = (label: string, value: number, bold = false) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal')
    pdf.text(label, 18, y)
    pdf.text(pdfPeso(value), 192, y, { align: 'right' })
    y += 8
  }
  amount('Rental quote', rentalQuote)
  amount('Security deposit', deposit)
  amount('Total quoted', rentalQuote + deposit, true)
  pdf.line(18, y, 192, y)
  y += 10

  detail('Late return', `${pdfPeso(lateFee)} per day after the return deadline.`)
  detail('Missing pieces', 'Charges may be deducted from the security deposit.')
  detail('Deposit amount recorded', `${pdfPeso(booking.deposit_amount ?? deposit)} via ${booking.payment_method || 'Not recorded'}.`)
  if (booking.payment_ref) detail('Payment reference', booking.payment_ref)
  pdf.setFontSize(9)
  pdf.setTextColor(100)
  pdf.text(
    pdf.splitTextToSize(
      'Keep this receipt as your record of the booking quote and terms. Payment references are subject to shop verification.',
      174
    ) as string[],
    18,
    y
  )

  pdf.save(`rentify-receipt-${booking.id}.pdf`)
}

export default function MyBookingsPage({ onMessage }: { onMessage: (branchId?: string) => void }) {
  const [list, setList] = useState<MyBooking[]>([])
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const cancelInFlight = useRef(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('bookings').select('*, items(*, branches(name))').order('start_date', { ascending: false })
    if (error) setErr(error.message)
    else setList((data ?? []) as unknown as MyBooking[])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const run = async (fn: 'request_extension', id: string) => {
    const { error } = await supabase.rpc(fn, { p_id: id })
    if (error) setErr(error.message)
    else load()
  }

  const confirmCancellation = async () => {
    if (!confirmingCancelId || cancelInFlight.current) return

    cancelInFlight.current = true
    setCancelling(true)
    setErr('')
    setSuccess('')
    try {
      const { error } = await supabase.rpc('cancel_booking', { p_id: confirmingCancelId })
      if (error) {
        setErr(error.message)
        return
      }

      const { data: updated, error: verifyError } = await supabase
        .from('bookings')
        .select('status')
        .eq('id', confirmingCancelId)
        .maybeSingle()
      if (verifyError) {
        setErr(verifyError.message)
        return
      }
      if (!updated || !['cancelled', 'canceled'].includes(norm(updated.status))) {
        setErr('This booking could not be cancelled. It may have already been confirmed by the shop.')
        await load()
        return
      }

      setConfirmingCancelId(null)
      setSuccess('Booking cancelled successfully.')
      await load()
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Could not cancel booking. Please try again.')
    } finally {
      cancelInFlight.current = false
      setCancelling(false)
    }
  }

  const now = today()
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {err && <p className="mb-3 text-sm text-cleaning">{err}</p>}
      {success && <p role="status" className="mb-3 text-sm text-green-800">{success}</p>}
      {loading && <p className="text-sm text-ink/60">Loading...</p>}
      {!loading && list.length === 0 && <p className="text-sm text-ink/60">No bookings yet.</p>}
      {list.map((b) => {
        const st = norm(b.status)
        const x = b.items
        const deadline = returnDeadline(b.end_date, b.return_grace_days ?? DEFAULT_RETURN_GRACE_DAYS)
        const fee = b.quoted_late_fee_per_day ?? x?.late_fee_per_day ?? 0
        const tag = TAG[st] ?? [st, 'bg-reserved text-ink']
        const when =
          st === 'out'
            ? deadline < now ? `Late by ${diffDays(deadline, now)} day(s). Fee so far ${peso(diffDays(deadline, now) * fee)}.`
              : b.end_date < now ? `Return grace period ends ${fmt(deadline)}. No late fee yet.`
                : `Return by ${fmt(deadline)}.`
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
                <span className={`rounded-sm px-1.5 py-0.5 text-[9px] font-semibold ${tag[1]}`}>{tag[0]}</span>
              </div>
              <p className="text-ink/60">Pickup {fmt(b.start_date)} · Rental ends {fmt(b.end_date)} · Return by <b className="text-ink">{fmt(deadline)}</b></p>
              {when && <p>{when}</p>}
              <p className="text-ink/60">Branch: {x?.branches?.name}</p>
              {st === 'pending' && <p className="font-bold">Waiting for the shop to confirm.</p>}
              {b.extension_requested && <p className="font-bold">Extension requested; new return deadline would be {fmt(returnDeadline(addDays(b.end_date, 1), b.return_grace_days ?? DEFAULT_RETURN_GRACE_DAYS))}. Waiting for the shop.</p>}
              {b.payment_ref && (
                <p className="font-bold">Deposit {peso(b.deposit_amount ?? 0)} paid online via {b.payment_method} (ref {b.payment_ref})</p>
              )}
              <p className="text-ink/50">
                {x?.inclusions ? `Pieces: ${x.inclusions} · ` : ''}Deposit {peso(b.quoted_deposit_amount ?? x?.deposit ?? 0)} · Late fee after ${fmt(deadline)}: {peso(fee)}/day
              </p>
            </div>
            <div className="w-44 space-y-2">
              <button className={btnDark} onClick={() => onMessage(x?.branch_id ?? undefined)}>Message {x?.branches?.name}</button>
              <button
                className={btnGrey}
                onClick={async () => {
                  try {
                    await downloadReceiptPdf(b)
                    setErr('')
                  } catch (error) {
                    setErr(error instanceof Error ? error.message : 'Could not create receipt PDF.')
                  }
                }}
              >
                Save receipt as PDF
              </button>
              {(st === 'pending' || st === 'reserved') && (
                <button className={btnGrey} onClick={() => { setErr(''); setSuccess(''); setConfirmingCancelId(b.id) }}>
                  Cancel booking
                </button>
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
      {confirmingCancelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-booking-title"
            aria-describedby="cancel-booking-message"
            className="w-full max-w-md rounded-sm bg-white p-6 shadow-xl"
          >
            <h2 id="cancel-booking-title" className="text-xl font-bold text-ink">Cancel Booking?</h2>
            <p id="cancel-booking-message" className="mb-6 mt-3 text-sm text-ink/70">
              Are you sure you want to cancel this booking? This action cannot be undone.
            </p>
            <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
              <button
                type="button"
                className="rounded-sm bg-cell px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
                onClick={() => setConfirmingCancelId(null)}
                disabled={cancelling}
              >
                Keep Booking
              </button>
              <button
                type="button"
                className="rounded-sm bg-booked px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                onClick={() => void confirmCancellation()}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling...' : 'Yes, Cancel Booking'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}