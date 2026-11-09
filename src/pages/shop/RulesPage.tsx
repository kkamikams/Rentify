import { supabase } from '../../lib/supabaseClient'
import type { Shop } from '../../lib/shop'
import { CATEGORIES, income, inBranch, branchName, isSold, peso } from '../../lib/shop'
import { card, input, Sub, td, th } from '../../lib/ui'

export default function RulesPage({ shop, branch }: { shop: Shop; branch: string }) {
  const rule = (c: string) => shop.rules.find((r) => r.category === c) ?? { category: c, buffer_days: 2, deposit: 0 }
  const save = (c: string, patch: object) =>
    shop.act(
      supabase.from('type_rules').upsert({ ...rule(c), ...patch, shop_id: shop.shopId }, { onConflict: 'shop_id,category' })
    )

  const sold = shop.bookings.filter((b) => isSold(b) && inBranch(branch, branchName(b)))
  const sales = CATEGORIES.map((c) => [c, sold.filter((b) => b.items?.category === c).reduce((s, b) => s + income(b), 0)] as const)

  return (
    <div>
      <section className={card}>
        <h3 className="text-base font-semibold">Rules per clothing type</h3>
        <Sub>Default for new items. Change an item's own values in Inventory.</Sub>
        <table className="mt-6 w-full">
          <thead><tr><th className={th}>Item</th><th className={th}>Buffer Days</th><th className={th}>Deposit</th></tr></thead>
          <tbody>
            {CATEGORIES.map((c) => (
              <tr key={c}>
                <td className={td}>{c}</td>
                <td className={td}>
                  <select className={`${input} w-28`} value={rule(c).buffer_days} onChange={(e) => save(c, { buffer_days: Number(e.target.value) })}>
                    {[0, 1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}
                  </select>
                </td>
                <td className={td}>
                  <input type="number" min={0} className={`${input} w-28`} key={`${c}${rule(c).deposit}`}
                    defaultValue={rule(c).deposit} onBlur={(e) => save(c, { deposit: Number(e.target.value) || 0 })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={card}>
        <h3 className="text-base font-semibold">Sales tracker</h3>
        <Sub>Optional extra. Rental income from the bookings.</Sub>
        <table className="mt-6 w-full">
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
