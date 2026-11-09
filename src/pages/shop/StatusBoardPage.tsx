import { supabase } from '../../lib/supabaseClient'
import type { Shop } from '../../lib/shop'
import { branchName, fmt, inBranch, norm } from '../../lib/shop'
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
    <div className="grid auto-cols-[175px] grid-flow-col gap-3 overflow-x-auto pb-4">
      {COLS.map(([key, label]) => (
        <div key={key} className="border-r border-ink/20 pr-3">
          <h3 className="mb-3 text-center text-base font-semibold">{label}</h3>
          {mine.filter((b) => norm(b.status) === key).map((b) => (
            <div key={b.id} className="mb-3 rounded-sm bg-white p-3 text-center shadow-sm">
              <div className="mb-2 border-b border-ink/20 pb-1 text-xs font-semibold">{branchName(b)}</div>
              <div className="text-xs font-bold">{b.items?.name}</div>
              <div className="mb-2 text-[9px]">{b.customer_name} · {fmt(b.start_date)} - {fmt(b.end_date)}</div>
              {key === 'pending' ? (
                <div className="flex gap-1">
                  <button className={`${btn} flex-1 px-2 text-xs`} onClick={() => set(b.id, 'reserved')}>Confirm</button>
                  <button className={`${btn2} flex-1 px-2 text-xs`} onClick={() => set(b.id, 'cancelled')}>Decline</button>
                </div>
              ) : NEXT[key] ? (
                <button className={`${btn} w-full px-2 text-xs`} onClick={() => set(b.id, NEXT[key][0])}>
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
