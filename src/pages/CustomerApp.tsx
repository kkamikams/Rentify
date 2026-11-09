import { useEffect, useMemo, useState } from 'react'
import { MessageCircle, ShoppingBag, User } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { peso } from '../lib/shop'
import { Tag } from '../lib/ui'

type Row = {
  id: string; name: string; category: string | null
  price_per_day: number | null; deposit: number | null
  branches: { name: string } | null
}
type Product = { name: string; category: string | null; price: number; deposit: number; branches: string[] }

const BRANCHES = ['All branches', 'CDO Downtown', 'CDO Uptown']
const CATS = ['Gown', 'Formal wear', 'Costume', 'Barong']
const label = (c: string) => (c === 'Formal wear' ? 'Formal Wear' : c)
const amber = 'font-semibold text-[#E3A21A]'

const Facebook = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z" />
  </svg>
)
const Instagram = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
)

function Card({ p }: { p: Product }) {
  return (
    <div>
      <div className="aspect-[3/4] bg-white" />
      <p className="mt-2 text-[11px]">{p.name}</p>
      <p className="text-[11px]"><span className={amber}>{peso(p.price)}</span> + {peso(p.deposit)} deposit</p>
      <div className="mt-1 flex flex-wrap gap-1">{p.branches.map((b) => <Tag key={b}>{b}</Tag>)}</div>
    </div>
  )
}

export default function CustomerApp({ name, onSignOut }: { name?: string; onSignOut: () => void }) {
  const [view, setView] = useState<'home' | 'catalog' | 'bookings' | 'messages'>('home')
  const [branch, setBranch] = useState(BRANCHES[0])
  const [cat, setCat] = useState('All')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('items')
      .select('id, name, category, price_per_day, deposit, branches(name)')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setRows((data ?? []) as unknown as Row[])
      })
  }, [])

  // One card per item name; the tags list every branch that has it
  const products = useMemo(() => {
    const m = new Map<string, Product>()
    rows
      .filter((r) => branch === 'All branches' || r.branches?.name === branch)
      .forEach((r) => {
        const p = m.get(r.name) ?? { name: r.name, category: r.category, price: r.price_per_day ?? 0, deposit: r.deposit ?? 0, branches: [] }
        if (r.branches?.name && !p.branches.includes(r.branches.name)) p.branches.push(r.branches.name)
        m.set(r.name, p)
      })
    return [...m.values()]
  }, [rows, branch])

  const shown = products.filter(
    (p) => (cat === 'All' || p.category === cat) && p.name.toLowerCase().includes(q.toLowerCase())
  )
  const go = (v: typeof view, c = 'All') => { setView(v); setCat(c) }

  return (
    <div className="min-h-screen bg-cream">
      <div className="bg-ink py-2 text-center text-[11px] font-medium tracking-wide text-cream">
        {view === 'home' ? 'YOUR NEXT OCCASION, YOUR PERFECT OUTFIT.' : 'FIND YOUR FIT'}
      </div>

      <header className="bg-cream shadow-[0_2px_3px_rgba(63,49,43,0.25)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <button onClick={() => go('home')} className="text-xl font-semibold">Rentify.</button>
          <nav className="flex gap-10 text-sm font-medium">
            {BRANCHES.map((b) => (
              <button key={b} onClick={() => { setBranch(b); setView('catalog') }}
                className={`pb-0.5 ${view === 'catalog' && branch === b ? 'border-b-2 border-ink' : 'border-b-2 border-transparent'}`}>
                {b}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-5">
            {name && <span className="hidden text-sm sm:inline">{name}</span>}
            <button onClick={() => go('messages')} title="Messages" aria-label="Messages"><MessageCircle size={20} fill="currentColor" /></button>
            <button onClick={onSignOut} title="Sign out" aria-label="Sign out"><User size={20} fill="currentColor" /></button>
            <button onClick={() => go('bookings')} title="My bookings" aria-label="My bookings"><ShoppingBag size={20} fill="currentColor" /></button>
          </div>
        </div>
      </header>

      {error && <p className="px-6 pt-4 text-sm text-cleaning">{error}</p>}

      {view === 'home' && (
        <>
          <section className="bg-reserved">
            <div className="mx-auto max-w-6xl px-6 py-16">
              <h1 className="text-3xl font-bold leading-snug">
                Dress for the moment,<br />Rent it with <span className="font-light italic">Rentify.</span>
              </h1>
              <p className="mb-6 mt-3 text-xs">Find your perfect outfit for every occasion.</p>
              <button onClick={() => go('catalog')} className="rounded-sm bg-ink px-5 py-2.5 text-sm font-semibold text-cream shadow">
                Browse Rentals →
              </button>
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-6 py-10">
            <h2 className="mb-6 inline-block border-b-2 border-ink pb-1 text-sm font-medium tracking-wide">RENT BY CATEGORY</h2>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              {CATS.map((c) => (
                <div key={c} className="flex h-44 flex-col justify-end bg-white p-3 shadow-sm">
                  <button onClick={() => go('catalog', c)} className="rounded-sm bg-booked py-1.5 text-sm font-semibold text-white shadow">
                    {label(c)}{c === 'Costume' ? 's' : ''}
                  </button>
                </div>
              ))}
            </div>

            <h2 className="mb-6 mt-10 inline-block border-b-2 border-ink pb-1 text-sm font-medium tracking-wide">NEW ARRIVALS</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
              {products.slice(0, 6).map((p) => <Card key={p.name} p={p} />)}
            </div>
            {products.length === 0 && !error && <p className="text-sm text-ink/60">No items yet.</p>}
          </section>

          <footer className="bg-ink px-6 py-10 text-xs text-cream">
            <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8">
              <div className="space-y-3"><p className="text-sm font-semibold">Rentify.</p><p>Search</p><p>Book A Fitting</p><p>FAQ</p><p>Terms and Conditions</p></div>
              <div className="space-y-3"><p>SOCIALS</p><p className="flex items-center gap-2"><Facebook /> Facebook</p><p className="flex items-center gap-2"><Instagram /> Instagram</p></div>
            </div>
          </footer>
        </>
      )}

      {view === 'catalog' && (
        <main className="mx-auto max-w-6xl px-6 py-8">
          <nav className="mb-4 flex justify-center gap-8 text-sm font-medium">
            {['All', ...CATS].map((c) => (
              <button key={c} onClick={() => setCat(c)}
                className={`pb-0.5 ${cat === c ? 'border-b-2 border-ink' : 'border-b-2 border-transparent'}`}>
                {c === 'All' ? 'All' : label(c)}
              </button>
            ))}
          </nav>
          <div className="mb-6 flex items-center justify-center gap-4 text-[10px] text-ink/70">
            <span>{shown.length} products</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search"
              className="w-32 rounded-full bg-cell px-3 py-0.5 text-[10px]" />
          </div>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {shown.map((p) => <Card key={p.name} p={p} />)}
          </div>
          {shown.length === 0 && !error && <p className="text-center text-sm text-ink/60">No items found.</p>}
        </main>
      )}

      {(view === 'bookings' || view === 'messages') && (
        <main className="mx-auto max-w-6xl px-6 py-8">
          <h1 className="mb-4 text-lg font-medium">{view === 'bookings' ? 'My bookings' : 'Messages'}</h1>
          <p className="text-sm text-ink/60">This page is not built yet.</p>
        </main>
      )}
    </div>
  )
}
