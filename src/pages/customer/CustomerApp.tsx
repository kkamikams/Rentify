import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { MessageCircle, ShoppingBag, User } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useCatalog } from '../../lib/customer'
import AuthPage from '../AuthPage'
import HomePage from './HomePage'
import CatalogPage from './CatalogPage'
import ItemPage, { SentPage } from './ItemPage'
import MyBookingsPage from './MyBookingsPage'
import MessagesPage from './MessagesPage'

type View =
  | { name: 'home' }
  | { name: 'catalog' }
  | { name: 'item'; id: string }
  | { name: 'sent'; id: string; start: string; end: string }
  | { name: 'bookings' }
  | { name: 'messages'; branchId?: string }

export default function CustomerApp() {
  const cat = useCatalog()
  const [session, setSession] = useState<Session | null>(null)
  const [view, setView] = useState<View>({ name: 'home' })
  const [branch, setBranch] = useState('All branches')
  const [category, setCategory] = useState('All')
  const [showAuth, setShowAuth] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); if (s) setShowAuth(false) })
    return () => data.subscription.unsubscribe()
  }, [])

  const go = (v: View) => { setShowAuth(false); setView(v); window.scrollTo(0, 0) }
  const needAuth = !session && (showAuth || view.name === 'bookings' || view.name === 'messages')

  let page: ReactNode = null
  const v = view
  if (v.name === 'home') {
    page = (
      <HomePage items={cat.items}
        onCategory={(c) => { setCategory(c); go({ name: 'catalog' }) }}
        onOpen={(id) => go({ name: 'item', id })}
        onBrowse={() => { setCategory('All'); go({ name: 'catalog' }) }} />
    )
  } else if (v.name === 'catalog') {
    page = <CatalogPage items={cat.items} branch={branch} category={category} setCategory={setCategory}
      onOpen={(id) => go({ name: 'item', id })} />
  } else if (v.name === 'item' || v.name === 'sent') {
    const item = cat.items.find((i) => i.id === v.id)
    if (item && v.name === 'item') {
      page = (
        <ItemPage item={item} branches={cat.branches} shop={cat.shops.find((s) => s.id === item.shop_id)}
          session={session} onBack={() => go({ name: 'catalog' })} onNeedAuth={() => setShowAuth(true)}
          onSent={(start, end) => go({ name: 'sent', id: item.id, start, end })} />
      )
    } else if (item && v.name === 'sent') {
      page = <SentPage item={item} start={v.start} end={v.end} onBookings={() => go({ name: 'bookings' })} />
    }
  } else if (v.name === 'bookings' && session) {
    page = <MyBookingsPage onMessage={(branchId) => go({ name: 'messages', branchId })} />
  } else if (v.name === 'messages' && session) {
    page = <MessagesPage session={session} branches={cat.branches} initialBranch={v.branchId} />
  }

  const branchTabs = ['All branches', ...cat.branches.map((b) => b.name)]

  return (
    <div className="min-h-screen bg-cream">
      <div className="bg-ink py-2 text-center text-[11px] font-medium tracking-wide text-white">
        {view.name === 'home' ? 'YOUR NEXT OCCASION, YOUR PERFECT OUTFIT.' : 'FIND YOUR FIT'}
      </div>
      <header className="bg-cream shadow-[0_2px_3px_rgba(63,49,43,0.25)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <button onClick={() => go({ name: 'home' })} className="text-xl font-bold">Rentify.</button>
          {view.name === 'home' ? (
            <nav className="hidden gap-10 text-xs font-medium sm:flex">
              <span>FAQ</span><span>How It Works</span>
              <button onClick={() => go({ name: 'catalog' })}>Book A Fitting</button>
            </nav>
          ) : (
            <nav className="hidden gap-12 text-sm font-medium sm:flex">
              {branchTabs.map((b) => (
                <button key={b} onClick={() => { setBranch(b); if (view.name !== 'catalog') go({ name: 'catalog' }) }}
                  className={`pb-0.5 ${branch === b ? 'border-b-2 border-ink' : 'border-b-2 border-transparent'}`}>
                  {b}
                </button>
              ))}
            </nav>
          )}
          <div className="flex items-center gap-4">
            <button aria-label="Messages" title="Messages" onClick={() => go({ name: 'messages' })}><MessageCircle size={18} fill="currentColor" /></button>
            <button aria-label={session ? 'Sign out' : 'Sign in'} title={session ? 'Sign out' : 'Sign in'}
              onClick={() => (session ? supabase.auth.signOut() : setShowAuth(true))}><User size={18} fill="currentColor" /></button>
            <button aria-label="My bookings" title="My bookings" onClick={() => go({ name: 'bookings' })}><ShoppingBag size={18} fill="currentColor" /></button>
          </div>
        </div>
      </header>

      {cat.error && <p className="p-4 text-sm text-cleaning">{cat.error}</p>}
      <div className={needAuth ? 'hidden' : ''}>{page}</div>
      {needAuth && (
        <div>
          <button onClick={() => { setShowAuth(false); if (view.name !== 'item') go({ name: 'home' }) }}
            className="mx-auto block px-6 pt-6 text-sm">← Back</button>
          <AuthPage />
        </div>
      )}
    </div>
  )
}
