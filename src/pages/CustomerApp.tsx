import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { MessageCircle, ShoppingBag, User } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { peso } from '../lib/shop'
import { Tag } from '../lib/ui'
import { useCatalog } from '../lib/customer'
import type { CItem } from '../lib/customer'
import ItemPage, { SentPage } from './customer/ItemPage'
import MyBookingsPage from './customer/MyBookingsPage'
import MessagesPage from './customer/MessagesPage'

type Product = { name: string; category: string | null; price: number; deposit: number; branches: string[]; rows: CItem[] }
type View = 'home' | 'catalog' | 'item' | 'sent' | 'bookings' | 'messages'

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

function Card({ p, showBranch, onOpen }: { p: Product; showBranch: boolean; onOpen: () => void }) {
  const img = p.rows.find((r) => r.image_url)?.image_url
  return (
    <button onClick={onOpen} className="text-left">
      <div className="aspect-[3/4] w-full overflow-hidden bg-white">
        {img && <img src={img} alt={p.name} className="h-full w-full object-cover" />}
      </div>
      <p className="mt-2 text-[11px]">{p.name}</p>
      <p className="text-[11px]"><span className={amber}>{peso(p.price)}</span> + {peso(p.deposit)} deposit</p>
      {showBranch && (
        <div className="mt-1 flex flex-wrap gap-1">{p.branches.map((b) => <Tag key={b}>{b}</Tag>)}</div>
      )}
    </button>
  )
}

export default function CustomerApp({ name, onSignOut }: { name?: string; onSignOut: () => void }) {
  const cat = useCatalog()
  const [session, setSession] = useState<Session | null>(null)
  const [view, setView] = useState<View>('home')
  const [branch, setBranch] = useState('All branches')
  const [category, setCategory] = useState('All')
  const [q, setQ] = useState('')
  const [itemId, setItemId] = useState('')
  const [sent, setSent] = useState({ start: '', end: '' })
  const [msgBranch, setMsgBranch] = useState<string | undefined>()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  // Newest items first
  const rows = useMemo(
    () => [...cat.items].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')),
    [cat.items]
  )

  // Branch names come from the items. One branch = no branch tabs and no branch tags.
  const branchNames = useMemo(
    () => [...new Set(rows.map((r) => r.branches?.name).filter((n): n is string => !!n))].sort(),
    [rows]
  )
  const multi = branchNames.length > 1
  const active = multi ? branch : 'All branches'

  // One card per item name; the tags list every branch that has it
  const products = useMemo(() => {
    const m = new Map<string, Product>()
    rows
      .filter((r) => active === 'All branches' || r.branches?.name === active)
      .forEach((r) => {
        const p = m.get(r.name) ?? { name: r.name, category: r.category, price: r.price_per_day ?? 0, deposit: r.deposit ?? 0, branches: [], rows: [] }
        if (r.branches?.name && !p.branches.includes(r.branches.name)) p.branches.push(r.branches.name)
        p.rows.push(r)
        m.set(r.name, p)
      })
    return [...m.values()]
  }, [rows, active])

  const shown = products.filter(
    (p) => (category === 'All' || p.category === category) && p.name.toLowerCase().includes(q.toLowerCase())
  )

  const go = (v: View, c = 'All') => { setView(v); setCategory(c); window.scrollTo(0, 0) }
  const open = (p: Product) => {
    const r = p.rows.find((x) => x.branches?.name === active) ?? p.rows[0]
    setItemId(r.id)
    setView('item')
    window.scrollTo(0, 0)
  }
  const item = cat.items.find((i) => i.id === itemId)

  return (
    <div className="min-h-screen bg-cream">
      <div className="bg-ink py-2 text-center text-[11px] font-medium tracking-wide text-cream">
        {view === 'home' ? 'YOUR NEXT OCCASION, YOUR PERFECT OUTFIT.' : 'FIND YOUR FIT'}
      </div>

      <header className="bg-cream shadow-[0_2px_3px_rgba(63,49,43,0.25)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <button onClick={() => go('home')} className="text-xl font-semibold">Rentify.</button>
          {multi && (
            <nav className="flex gap-10 text-sm font-medium">
              {['All branches', ...branchNames].map((b) => (
                <button key={b} onClick={() => { setBranch(b); go('catalog') }}
                  className={`pb-0.5 ${view === 'catalog' && active === b ? 'border-b-2 border-ink' : 'border-b-2 border-transparent'}`}>
                  {b}
                </button>
              ))}
            </nav>
          )}
          <div className="flex items-center gap-5">
            {name && <span className="hidden text-sm sm:inline">{name}</span>}
            <button onClick={() => { setMsgBranch(undefined); go('messages') }} title="Messages" aria-label="Messages"><MessageCircle size={20} fill="currentColor" /></button>
            <button onClick={onSignOut} title="Sign out" aria-label="Sign out"><User size={20} fill="currentColor" /></button>
            <button onClick={() => go('bookings')} title="My bookings" aria-label="My bookings"><ShoppingBag size={20} fill="currentColor" /></button>
          </div>
        </div>
      </header>

      {cat.error && <p className="px-6 pt-4 text-sm text-cleaning">{cat.error}</p>}

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
              {products.slice(0, 6).map((p) => <Card key={p.name} p={p} showBranch={multi} onOpen={() => open(p)} />)}
            </div>
            {products.length === 0 && !cat.error && <p className="text-sm text-ink/60">No items yet.</p>}
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
              <button key={c} onClick={() => setCategory(c)}
                className={`pb-0.5 ${category === c ? 'border-b-2 border-ink' : 'border-b-2 border-transparent'}`}>
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
            {shown.map((p) => <Card key={p.name} p={p} showBranch={multi} onOpen={() => open(p)} />)}
          </div>
          {shown.length === 0 && !cat.error && <p className="text-center text-sm text-ink/60">No items found.</p>}
        </main>
      )}

      {view === 'item' && item && (
        <ItemPage
          key={item.id}
          item={item}
          branches={cat.branches}
          shop={cat.shops.find((s) => s.id === item.shop_id)}
          session={session}
          onBack={() => go('catalog')}
          onNeedAuth={() => {}}
          onSent={(start, end) => { setSent({ start, end }); setView('sent'); window.scrollTo(0, 0) }}
        />
      )}

      {view === 'sent' && item && (
        <SentPage item={item} start={sent.start} end={sent.end}
          onBack={() => go('catalog')} onBookings={() => go('bookings')} />
      )}

      {view === 'bookings' && (
        <MyBookingsPage onMessage={(b) => { setMsgBranch(b); go('messages') }} />
      )}

      {view === 'messages' && session && (
        <MessagesPage session={session} branches={cat.branches} initialBranch={msgBranch} />
      )}
    </div>
  )
}
