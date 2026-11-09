import type { Shop } from '../../lib/shop'
import { branchName, inBranch, isCancelled, norm, peso, today } from '../../lib/shop'
import { card, Stat, td, th } from '../../lib/ui'

export default function ReportsPage({ shop, branch }: { shop: Shop; branch: string }) {
  const mine = shop.bookings.filter((b) => inBranch(branch, branchName(b)))
  const real = mine.filter((b) => !isCancelled(b))
  const overdue = mine.filter((b) => norm(b.status) === 'out' && b.end_date < today()).length
  const pending = mine.filter((b) => norm(b.status) === 'pending').length
  const fees = mine.reduce((s, b) => s + (b.late_fee ?? 0), 0)

  const counts = new Map<string, number>()
  real.forEach((b) => counts.set(b.items?.name ?? '?', (counts.get(b.items?.name ?? '?') ?? 0) + 1))
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Bookings" value={real.length} />
        <Stat label="Fees Collected" value={peso(fees)} />
        <Stat label="Overdue Now" value={overdue} tone={overdue ? 'text-cleaning' : ''} />
        <Stat label="Pending requests" value={pending} />
      </div>
      <section className={card}>
        <h3 className="mb-3 text-base font-semibold">Most Rented Items</h3>
        <table className="w-full">
          <thead><tr><th className={th}>Item</th><th className={th}>Bookings</th></tr></thead>
          <tbody>
            {top.map(([name, n]) => <tr key={name}><td className={td}>{name}</td><td className={td}>{n}</td></tr>)}
          </tbody>
        </table>
        {top.length === 0 && <p className="pt-3 text-xs text-ink/60">No bookings yet.</p>}
      </section>
    </div>
  )
}
