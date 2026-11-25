import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { peso } from '../lib/shop'
import { Tag } from '../lib/ui'
import { isValidName, digitsOnly, isValidPhone } from '../lib/name'
import { useCatalog } from '../lib/customer'
import type { CItem } from '../lib/customer'
import { itemImages } from '../lib/customer'
import CustomerHeader from '../components/CustomerHeader'
import ItemPage, { SentPage } from './customer/ItemPage'
import MyBookingsPage from './customer/MyBookingspage'
import MessagesPage from './customer/MessagesPage'
import ProfilePage, { AccountLayout } from './customer/ProfilePage'

type Product = { name: string; category: string | null; price: number; deposit: number; branches: string[]; rows: CItem[] }
type View = 'home' | 'catalog' | 'item' | 'sent' | 'bookings' | 'messages' | 'profile'
type CustomerMeta = { full_name?: string; phone?: string | null; addresses?: string[] }

const CATS = ['Gown', 'Formal wear', 'Costume', 'Traditional']
const label = (c: string) => (c === 'Formal wear' ? 'Formal Wear' : c)
const amber = 'font-semibold text-[#E3A21A]'

function CustomerProfileSetup({ user }: { user: Session['user'] }) {
  const meta = user.user_metadata as CustomerMeta
  const [open, setOpen] = useState(user.user_metadata?.customer_profile_completed !== true)
  const [name, setName] = useState(String(meta.full_name ?? ''))
  const [phone, setPhone] = useState(String(meta.phone ?? ''))
  const addresses = Array.isArray(meta.addresses)
    ? meta.addresses.filter((saved): saved is string => typeof saved === 'string')
    : []
  const [address, setAddress] = useState(addresses[0] ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!isValidName(name)) {
      setError('Full name must contain letters and cannot contain numbers.')
      return
    }
    if (!isValidPhone(phone)) {
      setError('Enter your mobile number using 10 to 15 digits.')
      return
    }
    setBusy(true)
    setError('')
    const updatedAddresses = address.trim()
      ? [address.trim(), ...addresses.filter((saved) => saved !== address.trim())]
      : addresses
    const { error: saveError } = await supabase.auth.updateUser({
      data: {
        full_name: name.trim(),
        phone: phone.trim(),
        addresses: updatedAddresses,
        customer_profile_completed: true,
      },
    })
    setBusy(false)
    if (saveError) {
      setError(saveError.message)
      return
    }
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="customer-profile-setup-title"
        className="w-full max-w-lg rounded-sm bg-white p-8 shadow-lg">
        <h2 id="customer-profile-setup-title" className="text-xl font-bold">Complete your profile</h2>
        <p className="mb-5 mt-2 text-sm text-ink/70">
          Add your contact details so shops can reach you about reservations.
        </p>
        <form onSubmit={save} className="space-y-4">
          <label className="block text-sm text-ink/70">
            Full name
            <input autoFocus required className="mt-1 w-full rounded-sm border border-ink/25 bg-white px-3 py-2.5 text-sm"
              value={name} onChange={(e) => setName(e.target.value.replace(/[\p{N}\d]/gu, ''))} />
          </label>
          <label className="block text-sm text-ink/70">
            Mobile number
            <input required type="tel" inputMode="numeric" minLength={10} maxLength={15} pattern="[0-9]{10,15}" placeholder="Mobile number"
              className="mt-1 w-full rounded-sm border border-ink/25 bg-white px-3 py-2.5 text-sm"
              value={phone} onChange={(e) => setPhone(digitsOnly(e.target.value))} />
          </label>
          <label className="block text-sm text-ink/70">
            Primary pickup address <span className="text-ink/50">(optional)</span>
            <input className="mt-1 w-full rounded-sm border border-ink/25 bg-white px-3 py-2.5 text-sm"
              placeholder="Street, barangay, city" value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
          <p className="text-sm text-ink/60">Account email: {user.email}</p>
          {error && <p role="alert" className="text-sm text-cleaning">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" className="rounded-sm border border-ink/20 px-4 py-2 text-sm font-semibold"
              onClick={() => setOpen(false)}>
              Later
            </button>
            <button type="submit" disabled={busy}
              className="rounded-sm bg-booked px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? 'Saving…' : 'Save details'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

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
  const [hovered, setHovered] = useState(false)
  const images = itemImages(p.rows[0])
  return (
    <button onClick={onOpen} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} className="h-[445px] w-full text-left">
      <div className="relative h-96 w-full overflow-hidden bg-white">
        {images[0] && <img src={images[0]} alt={p.name} className="absolute inset-0 h-full w-full object-cover" />}
        {images[1] && <img src={images[1]} alt="" aria-hidden="true" className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-in-out ${hovered ? 'opacity-100' : 'opacity-0'}`} />}
      </div>
      <p className="mt-2 h-5 text-[13px] leading-5">{p.name}</p>
      <p className="h-5 text-[11px]"><span className={amber}>{peso(p.price)}</span> + {peso(p.deposit)} deposit</p>
      {showBranch && (
        <div className="mt-1 flex flex-wrap gap-1">{p.branches.map((b) => <Tag key={b}>{b}</Tag>)}</div>
      )}
    </button>
  )
}

export default function CustomerApp({
  name, onSignOut, guest = false, onNeedAuth,
}: { name?: string; onSignOut: () => void; guest?: boolean; onNeedAuth?: () => void }) {
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

  const go = (v: View, c = 'All') => {
    // Visitors who aren't logged in are sent to the log in page for account pages
    if (guest && (v === 'profile' || v === 'bookings' || v === 'messages')) { onNeedAuth?.(); return }
    setView(v); setCategory(c); window.scrollTo(0, 0)
  }
  const open = (p: Product) => {
    const r = p.rows.find((x) => x.branches?.name === active) ?? p.rows[0]
    setItemId(r.id)
    setView('item')
    window.scrollTo(0, 0)
  }
  const item = cat.items.find((i) => i.id === itemId)
  const account = view === 'profile' || view === 'bookings'

  return (
    <div className="min-h-screen bg-cream">
      <div className="sticky top-0 z-50">
        {!account && (
          <div className="bg-ink py-2 text-center text-[11px] font-medium tracking-wide text-cream">
            {view === 'home' ? 'YOUR NEXT OCCASION, YOUR PERFECT OUTFIT.' : 'FIND YOUR FIT'}
          </div>
        )}

        <CustomerHeader
        name={name}
        showBranches={multi && !account}
        branch={view === 'catalog' ? active : ''}
        branchNames={branchNames}
        activeAccountPage={view === 'profile' || view === 'bookings' ? view : undefined}
        onHome={() => go('home')}
        onBranchChange={(b) => { setBranch(b); go('catalog') }}
        onMessages={() => { setMsgBranch(undefined); go('messages') }}
        onProfile={() => go('profile')}
        onBookings={() => go('bookings')}
        />
      </div>

      {session && <CustomerProfileSetup key={session.user.id} user={session.user} />}

      {cat.error && <p className="px-3 pt-4 text-sm text-cleaning">{cat.error}</p>}

      {view === 'home' && (
        <>
          <section className="bg-reserved">
            <div className="mx-auto max-w-10xl px-12 py-16">
            <h1 className="text-4xl font-bold leading-snug" style={{ fontFamily: "'Dela Gothic One', sans-serif" }}>
                Dress for the moment,<br /> Rent it with{' '}
              <span
                className="text-7xl font-normal"
                style={{ fontFamily: "'Waterfall', cursive" }}>
                Rentify.
              </span>
            </h1>
              <p className="mb-6 mt-3 text-xs">Find your perfect outfit for every occasion.</p>
              <button onClick={() => go('catalog')} className="rounded-sm bg-[#45352F] px-5 py-2.5 text-sm font-semibold text-[#F8F3EB] shadow-[0_4px_2px_0_rgba(0,0,0,0.25)] transition-shadow duration-20 hover:bg-[#45352F] hover:text-[#F8F3EB] hover:[text-shadow:0_0_10px_rgba(248,243,235,1)] hover:shadow-[0_0_10px_0_rgba(69,53,47,1)] active:bg-[#45352F] active:text-white active:shadow-[inset_0_2px_7px_0_rgba(0,0,0,0.25),0_0_10px_0_rgba(69,53,47,1)]">
                Browse Rentals →
              </button>
            </div>
          </section>

          <section className="px-10 py-10">
            <div className="mb-10 text-center">
              <h2 className="inline-block border-b-2 border-ink pb-1 text-m font-medium tracking-wide">
                RENT BY CATEGORY
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-7 sm:grid-cols-4">
              {CATS.map((c) => (
                <div key={c}
                  className="flex h-96 flex-col justify-end bg-cover bg-center p-5 shadow-[0_5px_5px_rgba(0,0,0,0.08)]"
                  style={{
                    backgroundImage: (() => {
                      const shop = cat.shops.find((s) => s.category_images?.[c])
                      const url = shop?.category_images?.[c]
                      return url ? `url(${url})` : undefined
                    })(),
                  }}>
                  <button onClick={() => go('catalog', c)} className="w-full rounded-sm bg-[#A66F5B] py-4 text-xl font-semibold text-[#F8F3EB] shadow-[0_4px_2px_0_rgba(0,0,0,0.25)] transition-shadow duration-20 hover:bg-[#45352F] hover:text-[#F8F3EB] hover:[text-shadow:0_0_10px_rgba(248,243,235,1)] hover:shadow-[0_0_10px_0_rgba(69,53,47,1)] active:bg-[#45352F] active:text-white active:shadow-[inset_0_2px_7px_0_rgba(0,0,0,0.25),0_0_10px_0_rgba(69,53,47,1)]">
                    {label(c)}{c === 'Costume' ? 's' : ''}
                  </button>
                </div>
              ))}
            </div>

            <div className="mb-7 mt-7 text-center">
              <h2 className="inline-block border-b-2 border-ink pb-1 text-sm font-medium tracking-wide">
                NEW ARRIVALS
              </h2>
            </div>
            <div className="flex gap-5 overflow-x-auto pb-4">
              {products.map((p) => (
                <div key={p.name} className="w-72 shrink-0">
                  <Card p={p} showBranch={multi} onOpen={() => open(p)} />
                </div>
              ))}
            </div>
            {products.length === 0 && !cat.error && <p className="text-center text-sm text-ink/60">No items yet.</p>}
          </section>

          <footer className="bg-ink px-10 py-20 text-xs text-cream">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-64">    <div className="space-y-3">
                <p className="text-sm font-semibold">Rentify.</p>
                <p>Search</p>
                <p>Book A Fitting</p>
                <p>FAQ</p>
                <p>Terms and Conditions</p>
              </div>
              <div className="space-y-3">
                <p>SOCIALS</p>
                <p className="flex items-center gap-2"><Facebook /> Facebook</p>
                <p className="flex items-center gap-2"><Instagram /> Instagram</p>
              </div>
            </div>
          </footer>
        </>
      )}

      {view === 'catalog' && (
        <main className="mx-auto max-w-6xl px-3 py-8">
          <div className="mb-4">
            <button onClick={() => go('home')} aria-label="Back to home page"
              title="Back to home page" className="flex items-center text-sm font-medium hover:underline">
              <ArrowLeft size={18} />
            </button>
          </div>
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
          onNeedAuth={() => onNeedAuth?.()}
          onSent={(start, end) => { setSent({ start, end }); setView('sent'); window.scrollTo(0, 0) }}
        />
      )}

      {view === 'sent' && item && (
        <SentPage item={item} start={sent.start} end={sent.end}
          onBack={() => go('catalog')} onBookings={() => go('bookings')} />
      )}

      {view === 'profile' && session && (
        <AccountLayout tab="profile" onTab={(tab) => go(tab)}>
          <ProfilePage
            session={session}
            onSignOut={() => {
              setView('home')
              window.scrollTo(0, 0)
              onSignOut()
            }}
          />
        </AccountLayout>
      )}

      {view === 'bookings' && (
        <AccountLayout tab="bookings" onTab={(tab) => go(tab)}>
          <MyBookingsPage onMessage={(b) => { setMsgBranch(b); go('messages') }} />
        </AccountLayout>
      )}

      {view === 'messages' && session && (
        <MessagesPage session={session} branches={cat.branches} shops={cat.shops}
          initialBranch={msgBranch} onBack={() => go('home')} />
      )}
    </div>
  )
}