import { supabase } from '../../lib/supabaseClient'
import type { Shop } from '../../lib/shop'
import { branchName, fmt, inBranch, norm, returnDeadline } from '../../lib/shop'
import { btn, btn2 } from '../../lib/ui'

const COLS: [string, string][] = [
  ['pending', 'Pending'], ['reserved', 'Reserved'], ['out', 'Out'],
  ['in_transit', 'In Transit'], ['returned', 'Returned'], ['cleaning', 'Cleaning'], ['ready', 'Ready'],
]
const NEXT: Record<string, [string, string]> = {
  reserved: ['out', 'Out'], out: ['in_transit', 'in transit'], in_transit: ['returned', 'Returned'],
  returned: ['cleaning', 'Cleaning'], cleaning: ['ready', 'Ready'],
}

export default function StatusBoardPage({ shop, branch }: { shop: Shop; branch: string }) {
  const mine = shop.bookings.filter((b) => inBranch(branch, branchName(b)))
  const set = (id: string, status: string) => shop.act(supabase.from('bookings').update({ status }).eq('id', id))

  return (
    <div className="grid grid-cols-7 gap-3">
      {COLS.map(([key, label], index) => (
        <div key={key} className={`min-w-0 ${index < COLS.length - 1 ? 'border-r border-ink/20 pr-3' : ''}`}>
          <h3 className="mb-3 text-center text-xl font-bold">{label}</h3>
          {mine.filter((b) => norm(b.status) === key).map((b) => (
            <div key={b.id} className="mb-3 rounded-sm bg-white p-3 text-center shadow-sm">
              <div className="mb-2 border-b border-ink/20 pb-1 text-sm font-semibold">{branchName(b)}</div>
              <div className="text-sm font-bold">{b.items?.name}</div>
              <div className="mb-3 min-h-14 text-sm leading-5">
                {b.customer_name}<br />
                Rental: {fmt(b.start_date)}{b.end_date !== b.start_date ? ` - ${fmt(b.end_date)}` : ''}<br />
                Return by: {fmt(returnDeadline(b.end_date))}
              </div>
              {key === 'pending' ? (
                <div className="grid grid-cols-2 gap-1.5">
                  <button className={`${btn} w-full px-1 text-xs`} onClick={() => set(b.id, 'reserved')}>Confirm</button>
                  <button className={`${btn2} w-full px-1 text-xs`} onClick={() => set(b.id, 'cancelled')}>Decline</button>
                </div>
              ) : NEXT[key] ? (
                <button className={`${btn} w-full px-2 text-sm`} onClick={() => set(b.id, NEXT[key][0])}>
                  Move to {NEXT[key][1]}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
