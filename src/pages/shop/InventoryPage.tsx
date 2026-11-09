import { useState } from 'react'
import type { FocusEvent, FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { Shop } from '../../lib/shop'
import { CATEGORIES, inBranch } from '../../lib/shop'
import { btn, card, input, Sub, td, th } from '../../lib/ui'

const num = (e: FocusEvent<HTMLInputElement>) => Number(e.target.value) || 0

export default function InventoryPage({ shop, branch }: { shop: Shop; branch: string }) {
  const [f, setF] = useState({ name: '', category: CATEGORIES[0], branch_id: '', price: '', deposit: '', inclusions: '' })
  const list = shop.items.filter((i) => inBranch(branch, i.branches?.name))
  const save = (id: string, patch: object) => shop.act(supabase.from('items').update(patch).eq('id', id))
  const set = (k: string, v: string) => setF({ ...f, [k]: v })

  const add = async (e: FormEvent) => {
    e.preventDefault()
    const rule = shop.rules.find((r) => r.category === f.category)
    await shop.act(
      supabase.from('items').insert({
        shop_id: shop.shopId, name: f.name.trim(), category: f.category,
        branch_id: f.branch_id || shop.branches[0]?.id, price_per_day: Number(f.price) || 0,
        deposit: Number(f.deposit) || rule?.deposit || 0, inclusions: f.inclusions.trim() || null,
        buffer_days: rule?.buffer_days ?? 2,
      })
    )
    setF({ ...f, name: '', price: '', deposit: '', inclusions: '' })
  }

  return (
    <div>
      <Sub>Edit price, deposit and branch. Changes save when you leave a field.</Sub>
      <section className={`${card} overflow-x-auto`}>
        <table className="w-full min-w-[820px]">
          <thead><tr>
            {['Item', 'Type', 'Branch', 'Price/day', 'Deposit', 'Late fee/day', 'Inclusions'].map((h) => <th key={h} className={th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {list.map((i) => (
              <tr key={i.id}>
                <td className={`${td} font-semibold`}>{i.name}</td>
                <td className={td}>
                  <select className={input} value={i.category ?? ''} onChange={(e) => save(i.id, { category: e.target.value })}>
                    <option value="">-</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </td>
                <td className={td}>
                  <select className={input} value={i.branch_id ?? ''} onChange={(e) => save(i.id, { branch_id: e.target.value })}>
                    {shop.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </td>
                {(['price_per_day', 'deposit', 'late_fee_per_day'] as const).map((k) => (
                  <td key={k} className={td}>
                    <input type="number" min={0} className={`${input} w-24`} key={`${k}${i.id}${i[k]}`}
                      defaultValue={i[k] ?? 0} onBlur={(e) => save(i.id, { [k]: num(e) })} />
                  </td>
                ))}
                <td className={td}>
                  <input className={input} placeholder="e.g. Garment bag" key={`inc${i.id}${i.inclusions}`}
                    defaultValue={i.inclusions ?? ''} onBlur={(e) => save(i.id, { inclusions: e.target.value || null })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="pt-3 text-xs text-ink/60">No items yet.</p>}
      </section>

      <section className={card}>
        <h3 className="mb-4 text-base font-semibold">Add an item</h3>
        <form onSubmit={add} className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          <input className={`${input} col-span-2`} placeholder="Item name" required value={f.name} onChange={(e) => set('name', e.target.value)} />
          <select className={input} value={f.category} onChange={(e) => set('category', e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className={input} value={f.branch_id} onChange={(e) => set('branch_id', e.target.value)}>
            {shop.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <input type="number" min={0} className={input} placeholder="Price/day" value={f.price} onChange={(e) => set('price', e.target.value)} />
          <input type="number" min={0} className={input} placeholder="Deposit" value={f.deposit} onChange={(e) => set('deposit', e.target.value)} />
          <input className={`${input} col-span-2`} placeholder="Inclusions (comma separated)" value={f.inclusions} onChange={(e) => set('inclusions', e.target.value)} />
          <div className="col-span-2 sm:col-span-4"><button className={btn} type="submit">Add item</button></div>
        </form>
      </section>
    </div>
  )
}
