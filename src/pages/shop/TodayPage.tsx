import type { Booking, Shop } from '../../lib/shop'
import { branchName, diffDays, fmt, inBranch, norm, peso, today } from '../../lib/shop'
import { btn, card, Tag } from '../../lib/ui'

export default function TodayPage({ shop, branch }: { shop: Shop; branch: string }) {
  const now = today()
  const mine = shop.bookings.filter((b) => inBranch(branch, branchName(b)))
  const fee = (b: Booking) => b.items?.late_fee_per_day ?? 0
  const late = (b: Booking) => diffDays(b.end_date, now)
  const is = (b: Booking, s: string) => norm(b.status) === s

  const groups = [
    {
      title: 'Overdue', red: true,
      list: mine.filter((b) => is(b, 'out') && b.end_date < now),
      line: (b: Booking) => `Late ${late(b)} day(s), fee so far ${peso(late(b) * fee(b))}`,
      sms: (b: Booking) => `Reminder: ${b.items?.name} was due back ${fmt(b.end_date)}. Late fee is ${peso(fee(b))} per day.`,
    },
    {
      title: 'Due back today', red: false,
      list: mine.filter((b) => is(b, 'out') && b.end_date === now),
      line: () => 'Return Today',
      sms: (b: Booking) => `Reminder: please return ${b.items?.name} today.`,
    },
    {
      title: 'Pickups today', red: false,
      list: mine.filter((b) => is(b, 'reserved') && b.start_date === now),
      line: () => 'Pickup Today',
      sms: (b: Booking) => `Reminder: your ${b.items?.name} is ready for pickup today.`,
    },
    {
      title: 'In transit between branches', red: false,
      list: mine.filter((b) => is(b, 'in_transit')),
      line: () => 'Returned at another branch, on its way back',
      sms: (b: Booking) => `Thank you for returning ${b.items?.name}.`,
    },
  ]

  return (
    <div>
      {groups.map((g) => (
        <section key={g.title} className={card}>
          <h3 className="mb-3 text-base font-semibold">{g.title}</h3>
          {g.list.length === 0 && <p className="text-xs text-ink/60">Nothing here.</p>}
          {g.list.map((b) => (
            <div key={b.id} className="flex items-center justify-between py-1.5">
              <div className="text-xs">
                <div className="flex items-center gap-2 font-semibold">{b.items?.name} <Tag>{branchName(b)}</Tag></div>
                <div className="font-semibold">{b.customer_name}</div>
                <div className={g.red ? 'text-cleaning' : ''}>{g.line(b)}</div>
              </div>
              {b.customer_phone && (
                <a className={btn} href={`sms:${b.customer_phone}?body=${encodeURIComponent(g.sms(b))}`}>
                  Send Reminder
                </a>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
