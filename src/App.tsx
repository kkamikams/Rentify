import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabaseClient'
import AuthPage from './pages/AuthPage'
import ShopApp from './pages/ShopApp'
import CustomerApp from './pages/CustomerApp'

type Membership = {
  role: string
  shops: { id: string; name: string } | null
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [shopName, setShopName] = useState('')
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  // Accounts without a role (made before roles existed) are shop accounts
  const role = session?.user.user_metadata?.role === 'customer' ? 'customer' : 'shop'

  // Track who is logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => setSession(newSession)
    )
    return () => listener.subscription.unsubscribe()
  }, [])

  // Shop accounts: find the shop this user belongs to
  useEffect(() => {
    if (!session || role !== 'shop') {
      setMembership(null)
      return
    }
    supabase
      .from('shop_members')
      .select('role, shops(id, name)')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setMembership((data as unknown as Membership[])[0] ?? null)
      })
  }, [session, role, reload])

  async function createShop(e: FormEvent) {
    e.preventDefault()
    setError('')
    const { error } = await supabase.rpc('create_shop', { shop_name: shopName })
    if (error) setError(error.message)
    else setReload((n) => n + 1)
  }

  if (loading) return <p className="p-6">Loading...</p>

  if (!session) return <AuthPage />

  if (role === 'customer') {
    return (
      <CustomerApp
        name={session.user.user_metadata?.full_name}
        onSignOut={() => supabase.auth.signOut()}
      />
    )
  }

  if (!membership) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream p-6">
        <form
          onSubmit={createShop}
          className="w-full max-w-sm space-y-3 rounded-sm bg-white p-6 shadow"
        >
          <h1 className="text-xl font-semibold text-ink">Set up your shop</h1>
          <p className="text-sm text-ink/60">
            What is the name of your rental shop?
          </p>
          <input
            required
            placeholder="Shop name"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            className="w-full rounded-sm border border-ink/25 px-3 py-2"
          />
          <button
            type="submit"
            className="w-full rounded-sm bg-booked px-3 py-2 font-semibold text-white"
          >
            Create shop
          </button>
          {error && <p className="text-sm text-cleaning">{error}</p>}
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="w-full text-xs underline"
          >
            Log out
          </button>
        </form>
      </div>
    )
  }

  return (
    <ShopApp
      shopId={membership.shops?.id}
      shopName={membership.shops?.name}
      onSignOut={() => supabase.auth.signOut()}
    />
  )
}
