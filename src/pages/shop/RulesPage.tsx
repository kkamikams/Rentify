import { supabase } from '../../lib/supabaseClient'
import type { Shop } from '../../lib/shop'
import { CATEGORIES, income, inBranch, branchName, isSold, peso } from '../../lib/shop'
import { input } from '../../lib/ui'

// Sizes for this page, matched to the design
const section = 'mb-8 rounded-sm bg-white px-8 py-6 shadow-md'
const h = 'text-xl font-bold leading-tight'
const sub = 'text-sm text-ink/50'
const th = 'pb-2 text-left text-sm font-semibold'
const td = 'border-t border-ink/15 py-2 text-sm'
const field = `${input} h-9 w-full text-sm`

export default function RulesPage({ shop, branch }: { shop: Shop; branch: string }) {
  const rule = (c: string) => shop.rules.find((r) => r.category === c) ?? { category: c, buffer_days: 2, deposit: 0, late_fee_per_day: 0 }
  const save = (c: string, patch: object) =>
    shop.act(
      supabase.from('type_rules').upsert({ ...rule(c), ...patch, shop_id: shop.shopId }, { onConflict: 'shop_id,category' })
    )

  const sold = shop.bookings.filter((b) => isSold(b) && inBranch(branch, branchName(b)))
  const sales = CATEGORIES.map((c) => [c, sold.filter((b) => b.items?.category === c).reduce((s, b) => s + income(b), 0)] as const)

  return (
    <div>
      <section className={section}>
        <h3 className={h}>Rules per clothing type</h3>
        <p className={`${sub} mb-5`}>Default for new items. Change an item's own values in Inventory.</p>
        <table className="w-full">
          <thead><tr><th className={th}>Item</th><th className={th}>Buffer Days</th><th className={th}>Late fee/day</th></tr></thead>
          <tbody>
            {CATEGORIES.map((c) => (
              <tr key={c}>
                <td className={td}>{c}</td>
                <td className={td}>
                  <div className="w-48">
                    <input type="number" min={0} max={30} className={field} key={`b${c}${rule(c).buffer_days}`}
                      defaultValue={rule(c).buffer_days} onBlur={(e) => save(c, { buffer_days: Number(e.target.value) || 0 })} />
                  </div>
                </td>
                <td className={td}>
                  <div className="w-48">
                    <input type="number" min={0} className={field} key={`${c}${rule(c).late_fee_per_day}`}
                      defaultValue={rule(c).late_fee_per_day} onBlur={(e) => save(c, { late_fee_per_day: Number(e.target.value) || 0 })} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={section}>
        <h3 className={h}>Sales tracker</h3>
        <p className={`${sub} mb-5`}>Optional extra. Rental income from the bookings.</p>
        <table className="w-full">
          <thead><tr><th className={th}>Item</th><th className={th}>Income</th></tr></thead>
          <tbody>
            {sales.map(([c, a]) => <tr key={c}><td className={td}>{c}</td><td className={td}>{peso(a)}</td></tr>)}
            <tr><td className={`${td} font-bold`}>Total</td><td className={`${td} font-bold`}>{peso(sales.reduce((s, [, a]) => s + a, 0))}</td></tr>
          </tbody>
        </table>
      </section>
    </div>
  )
}