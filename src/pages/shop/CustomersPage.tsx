import { Fragment, useMemo, useState } from 'react'
import type { Shop } from '../../lib/shop'
import { branchName, diffDays, fmt, income, inBranch, isSold, norm, peso, today } from '../../lib/shop'
import { card, Sub, td, th } from '../../lib/ui'

export default function CustomersPage({ shop, branch }: { shop: Shop; branch: string }) {
  const [open, setOpen] = useState('')
  const rows = useMemo(() => {
    const now = today()
    const by = new Map<string, typeof shop.bookings>()
    shop.bookings
      .filter((b) => isSold(b) && inBranch(branch, branchName(b)))
      .forEach((b) => { const k = b.customer_name?.trim() || 'Unknown'; by.set(k, [...(by.get(k) ?? []), b]) })
    return [...by.entries()]
      .map(([name, list]) => ({
        name, list,
        phone: list[0].customer_phone,
        spent: list.reduce((s, b) => s + income(b), 0),
        owes: list
          .filter((b) => norm(b.status) === 'out' && b.end_date < now)
          .reduce((s, b) => s + diffDays(b.end_date, now) * (b.items?.late_fee_per_day ?? 0), 0),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [shop.bookings, branch])

  return (
    <div>
      <Sub>Click a customer to see their rental history.</Sub>
      <section className={card}>
        <table className="w-full">
          <thead><tr><th className={th}>Name</th><th className={th}>Phone</th><th className={th}>Rentals</th><th className={th}>Spent</th><th className={th}>Flag</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.name}>
                <tr className="cursor-pointer" onClick={() => setOpen(open === r.name ? '' : r.name)}>
                  <td className={td}>{r.name}</td><td className={td}>{r.phone ?? '-'}</td>
                  <td className={td}>{r.list.length}</td><td className={td}>{peso(r.spent)}</td>
                  <td className={`${td} font-semibold text-cleaning`}>{r.owes ? `Owes ${peso(r.owes)}` : ''}</td>
                </tr>
                {open === r.name && r.list.map((b) => (
                  <tr key={b.id} className="bg-cream/60">
                    <td className={`${td} pl-4`} colSpan={5}>
                      {b.items?.name} · {fmt(b.start_date)} - {fmt(b.end_date)} · {norm(b.status).replace('_', ' ')} · {peso(income(b))}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="pt-3 text-xs text-ink/60">No customers yet.</p>}
      </section>
    </div>
  )
}
