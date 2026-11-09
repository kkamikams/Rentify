import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { Cost, Shop } from '../../lib/shop'
import { branchName, income, inBranch, isSold, peso } from '../../lib/shop'
import { btn, card, input, Stat, Sub, td, th } from '../../lib/ui'

const CATS = ['Garment purchase', 'Cleaning', 'Repair', 'Rent and utilities', 'Staff', 'Other']

export default function CostsPage({ shop, branch }: { shop: Shop; branch: string }) {
  const [f, setF] = useState({ category: CATS[0], description: '', amount: '', target: 'shop' })

  const costBranch = (c: Cost) =>
    c.branch_id ? shop.branches.find((b) => b.id === c.branch_id)?.name ?? ''
      : shop.items.find((i) => i.id === c.item_id)?.branches?.name ?? ''
  const sold = shop.bookings.filter(isSold)
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
  const inc = (name: string) => sum(sold.filter((b) => inBranch(name, branchName(b))).map(income))
  const cst = (name: string) => sum(shop.costs.filter((c) => name === 'All branches' || costBranch(c) === name).map((c) => c.amount))
  const myCosts = shop.costs.filter((c) => branch === 'All branches' || costBranch(c) === branch)
  const byCat = CATS.map((k) => [k, sum(myCosts.filter((c) => c.category === k).map((c) => c.amount))] as const).filter(([, a]) => a > 0)
  const profit = inc(branch) - cst(branch)

  const add = async (e: FormEvent) => {
    e.preventDefault()
    const [kind, id] = f.target.split(':')
    await shop.act(
      supabase.from('costs').insert({
        shop_id: shop.shopId, category: f.category, description: f.description.trim() || null,
        amount: Number(f.amount) || 0, item_id: kind === 'item' ? id : null, branch_id: kind === 'branch' ? id : null,
      })
    )
    setF({ ...f, description: '', amount: '' })
  }

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Booked Rental Income" value={peso(inc(branch))} />
        <Stat label="Total Costs" value={peso(cst(branch))} />
        <Stat label="Profit" value={peso(profit)} tone={profit < 0 ? 'text-cleaning' : 'text-green-800'} />
      </div>

      <section className={card}>
        <h3 className="mb-3 text-sm font-semibold">Branches compared</h3>
        <table className="w-full">
          <thead><tr>{['Branch', 'Income', 'Costs', 'Profit'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {shop.branches.map((b) => (
              <tr key={b.id}>
                <td className={td}>{b.name}</td><td className={td}>{peso(inc(b.name))}</td><td className={td}>{peso(cst(b.name))}</td>
                <td className={`${td} font-semibold ${inc(b.name) - cst(b.name) < 0 ? 'text-cleaning' : 'text-green-800'}`}>{peso(inc(b.name) - cst(b.name))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={card}>
        <h3 className="mb-3 text-base font-semibold">Add a cost</h3>
        <form onSubmit={add} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <select className={input} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input className={`${input} sm:col-span-2`} placeholder="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          <input type="number" min={0} required className={input} placeholder="Amount (₱)" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          <select className={input} value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })}>
            <option value="shop">Shop-wide</option>
            {shop.branches.map((b) => <option key={b.id} value={`branch:${b.id}`}>Branch: {b.name}</option>)}
            {shop.items.map((i) => <option key={i.id} value={`item:${i.id}`}>Item: {i.name}</option>)}
          </select>
          <div className="col-span-2 sm:col-span-5"><button className={btn} type="submit">Add costs</button></div>
        </form>
      </section>

      <section className={card}>
        <h3 className="mb-3 text-base font-semibold">Costs by category</h3>
        <table className="w-full">
          <thead><tr><th className={th}>Category</th><th className={th}>Amount</th></tr></thead>
          <tbody>
            {byCat.map(([k, a]) => <tr key={k}><td className={td}>{k}</td><td className={td}>{peso(a)}</td></tr>)}
            <tr><td className={`${td} font-bold`}>Total</td><td className={`${td} font-bold`}>{peso(sum(byCat.map(([, a]) => a)))}</td></tr>
          </tbody>
        </table>
      </section>

      <section className={card}>
        <h3 className="text-base font-semibold">Profit per item</h3>
        <Sub>Costs set for a whole branch or the shop are not split across items.</Sub>
        <table className="mt-6 w-full">
          <thead><tr>{['Item', 'Income', 'Costs', 'Profit'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {shop.items.filter((i) => inBranch(branch, i.branches?.name)).map((i) => {
              const a = sum(sold.filter((b) => b.item_id === i.id).map(income))
              const c = sum(shop.costs.filter((x) => x.item_id === i.id).map((x) => x.amount))
              return (
                <tr key={i.id}>
                  <td className={td}>{i.name}</td><td className={td}>{peso(a)}</td><td className={td}>{peso(c)}</td>
                  <td className={`${td} font-semibold ${a - c < 0 ? 'text-cleaning' : 'text-green-800'}`}>{peso(a - c)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}
