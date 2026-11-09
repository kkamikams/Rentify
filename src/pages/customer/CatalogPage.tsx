import { useState } from 'react'
import type { CItem } from '../../lib/customer'
import { CATEGORY_TABS } from '../../lib/customer'
import { peso } from '../../lib/shop'

export function ItemCard({ item, onOpen, showBranch = false }: { item: CItem; onOpen: () => void; showBranch?: boolean }) {
  return (
    <button onClick={onOpen} className="text-left">
      <div className="mb-2 aspect-[3/4] w-full overflow-hidden bg-white shadow-sm">
        {item.image_url && <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />}
      </div>
      <div className="text-[11px]">{item.name}</div>
      <div className="text-[11px]">
        <span className="text-[#E3A72F]">{peso(item.price_per_day ?? 0)}</span> + {peso(item.deposit ?? 0)} deposit
      </div>
      {showBranch && item.branches && (
        <span className="mt-1 inline-block rounded-sm bg-reserved px-2 py-0.5 text-[9px] font-bold">{item.branches.name}</span>
      )}
    </button>
  )
}

export default function CatalogPage({
  items, branch, category, setCategory, onOpen,
}: {
  items: CItem[]; branch: string; category: string
  setCategory: (c: string) => void; onOpen: (id: string) => void
}) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('name')

  const list = items
    .filter((i) => branch === 'All branches' || i.branches?.name === branch)
    .filter((i) => category === 'All' || i.category === category)
    .filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) =>
      sort === 'low' ? (a.price_per_day ?? 0) - (b.price_per_day ?? 0)
        : sort === 'high' ? (b.price_per_day ?? 0) - (a.price_per_day ?? 0)
        : a.name.localeCompare(b.name)
    )

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <nav className="mb-6 flex justify-center gap-10 text-sm font-medium">
        {CATEGORY_TABS.map(([value, label]) => (
          <button key={value} onClick={() => setCategory(value)}
            className={`pb-0.5 ${category === value ? 'border-b-2 border-ink' : 'border-b-2 border-transparent'}`}>
            {label}
          </button>
        ))}
      </nav>
      <div className="mb-8 flex flex-wrap items-center justify-center gap-4 text-[10px]">
        <span>FILTERS AND SORT</span>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-sm border border-ink/25 bg-white px-2 py-1">
          <option value="name">Name</option>
          <option value="low">Price, low to high</option>
          <option value="high">Price, high to low</option>
        </select>
        <span>{list.length} products</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search"
          className="w-28 rounded-full border border-ink/25 bg-white px-3 py-1" />
      </div>
      {list.length === 0 && <p className="text-center text-sm text-ink/60">No items found.</p>}
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        {list.map((i) => <ItemCard key={i.id} item={i} onOpen={() => onOpen(i.id)} showBranch />)}
      </div>
    </div>
  )
}
