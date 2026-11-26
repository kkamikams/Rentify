import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import {
  Contact, CalendarDays, CalendarRange, CalendarCheck, ArrowLeftRight,
  Users, BookOpen, BarChart3, Newspaper, TrendingUp, MessageCircle, User,
} from 'lucide-react'
import { useShop } from '../lib/shop'
import { isValidName, digitsOnly, isValidPhone } from '../lib/name'
import RequestsPage from './shop/RequestsPage'
import TodayPage from './shop/TodayPage'
import CalendarPage from './shop/CalendarPage'
import StatusBoardPage from './shop/StatusBoardPage'
import PickupReturnPage from './shop/PickupReturnPage'
import CustomersPage from './shop/CustomersPage'
import InventoryPage from './shop/InventoryPage'
import CostsPage from './shop/CostsPage'
import ReportsPage from './shop/ReportsPage'
import RulesPage from './shop/RulesPage'
import ShopMessagesPage from './shop/ShopMessagesPage'
import ShopProfilePage from './shop/ShopProfilePage'
import { supabase } from '../lib/supabaseClient'
import type { Shop } from '../lib/shop'
import NotificationBell from '../components/NotificationBell'

const TABS = [
  { id: 'requests', icon: Contact, title: 'Reservation Requests' },
  { id: 'today', icon: CalendarDays, title: 'Today' },
  { id: 'calendar', icon: CalendarRange, title: 'Calendar' },
  { id: 'status', icon: CalendarCheck, title: 'Status Board' },
  { id: 'pickup', icon: ArrowLeftRight, title: 'Pickup and return' },
  { id: 'customers', icon: Users, title: 'Customers' },
  { id: 'inventory', icon: BookOpen, title: 'Inventory' },
  { id: 'costs', icon: BarChart3, title: 'Costs and Profit' },
  { id: 'reports', icon: Newspaper, title: 'Reports' },
  { id: 'rules', icon: TrendingUp, title: 'Rules and Sales' },
] as const

type TabId = (typeof TABS)[number]['id'] | 'messages' | 'profile'

function ShopOwnerSetup({ user, shop }: { user: SupabaseUser; shop: Shop }) {
  const [open, setOpen] = useState(
    user.user_metadata?.shop_profile_completed !== true ||
    user.user_metadata?.shop_branch_setup_completed !== true
  )
  const [name, setName] = useState(String(user.user_metadata?.full_name ?? ''))
  const [phone, setPhone] = useState(String(user.user_metadata?.phone ?? ''))
  const [branchMode, setBranchMode] = useState<'single' | 'multi'>(
    shop.branches.length > 1 || user.user_metadata?.branch_mode === 'multi' ? 'multi' : 'single'
  )
  const [locationNames, setLocationNames] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const existingLocations = shop.branches.map((branch) => branch.name)
  const activeBranchMode = shop.branches.length > 1 ? 'multi' : branchMode
  const locations = locationNames ?? (existingLocations.length ? existingLocations : [''])
  const plannedLocations = activeBranchMode === 'single' ? locations.slice(0, 1) : locations

  function changeLocation(index: number, value: string) {
    setLocationNames((current) => {
      const currentLocations = current ?? (existingLocations.length ? existingLocations : [''])
      return currentLocations.map((location, i) => i === index ? value : location)
    })
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!isValidName(name)) {
      setError('Owner name must contain letters and cannot contain numbers.')
      return
    }
    if (!isValidPhone(phone)) {
      setError('Enter your mobile number using 10 to 15 digits.')
      return
    }
    if (shop.loading) return
    if (plannedLocations.some((location) => !location.trim())) {
      setError('Enter a name for each branch location.')
      return
    }
    if (activeBranchMode === 'multi' && plannedLocations.length < 2) {
      setError('Add at least two branch locations or choose Single branch.')
      return
    }
    if (!shop.shopId) {
      setError('Shop details are still loading. Please try again.')
      return
    }

    setBusy(true)
    setError('')
    const existing = shop.branches
    for (let index = 0; index < Math.min(existing.length, plannedLocations.length); index += 1) {
      if (existing[index].name === plannedLocations[index].trim()) continue
      const { data, error: branchError } = await supabase.from('branches')
        .update({ name: plannedLocations[index].trim() }).eq('id', existing[index].id).select('id')
      if (branchError || !data?.length) {
        setBusy(false)
        setError(branchError?.message ?? `Could not update ${existing[index].name}. Check branch permissions.`)
        return
      }
    }
    for (let index = existing.length; index < plannedLocations.length; index += 1) {
      const { data, error: branchError } = await supabase.from('branches')
        .insert({ shop_id: shop.shopId, name: plannedLocations[index].trim() }).select('id')
      if (branchError || !data?.length) {
        setBusy(false)
        setError(branchError?.message ?? 'Could not add the branch location. Check branch permissions.')
        return
      }
    }
    await shop.reload()
    const { error: saveError } = await supabase.auth.updateUser({
      data: {
        full_name: name.trim(),
        phone: phone.trim(),
        shop_profile_completed: true,
        shop_branch_setup_completed: true,
        branch_mode: activeBranchMode,
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
      <section role="dialog" aria-modal="true" aria-labelledby="shop-owner-setup-title"
        className="w-full max-w-lg rounded-sm bg-white p-8 shadow-lg">
        <h2 id="shop-owner-setup-title" className="text-xl font-bold">Complete your owner profile</h2>
        <p className="mb-5 mt-2 text-sm text-ink/70">
          Add your contact details and tell us how many branch locations your shop has.
        </p>
        <form onSubmit={save} className="space-y-4">
          <label className="block text-sm text-ink/70">
            Owner name
            <input autoFocus required className="mt-1 w-full rounded-sm border border-ink/25 bg-white px-3 py-2.5 text-sm"
              value={name} onChange={(e) => setName(e.target.value.replace(/[\p{N}\d]/gu, ''))} />
          </label>
          <label className="block text-sm text-ink/70">
            Mobile number
            <input required type="tel" inputMode="numeric" minLength={10} maxLength={15} pattern="[0-9]{10,15}" placeholder="Mobile number"
              className="mt-1 w-full rounded-sm border border-ink/25 bg-white px-3 py-2.5 text-sm"
              value={phone} onChange={(e) => setPhone(digitsOnly(e.target.value))} />
          </label>
          <fieldset disabled={shop.loading || busy} className="space-y-2">
            <legend className="mb-2 text-sm font-semibold">Branch setup</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-sm border border-ink/20 p-3 text-sm">
                <input type="radio" name="branchMode" value="single" checked={activeBranchMode === 'single'}
                  disabled={shop.branches.length > 1}
                  onChange={() => setBranchMode('single')} />
                Single branch
              </label>
              <label className="flex items-center gap-2 rounded-sm border border-ink/20 p-3 text-sm">
                <input type="radio" name="branchMode" value="multi" checked={activeBranchMode === 'multi'}
                  onChange={() => setBranchMode('multi')} />
                Multiple branches
              </label>
            </div>
            {shop.branches.length > 1 && (
              <p className="text-sm text-ink/60">This shop already has multiple branches, so existing branch data is preserved.</p>
            )}
            {shop.loading ? (
              <p className="text-sm text-ink/60">Loading branch locations…</p>
            ) : (
              <div className="space-y-3">
                {plannedLocations.map((location, index) => (
                  <label key={`location-${index}`} className="block text-sm text-ink/70">
                    {plannedLocations.length === 1 ? 'Main branch location' : `Branch ${index + 1} location`}
                    <input required className="mt-1 w-full rounded-sm border border-ink/25 bg-white px-3 py-2.5 text-sm"
                      value={location} onChange={(e) => changeLocation(index, e.target.value)} />
                  </label>
                ))}
                {activeBranchMode === 'multi' && (
                  <button type="button" className="text-sm font-semibold underline"
                    onClick={() => setLocationNames([...locations, ''])}>
                    + Add branch
                  </button>
                )}
              </div>
            )}
          </fieldset>
          <p className="text-sm text-ink/60">Account email: {user.email}</p>
          {error && <p role="alert" className="text-sm text-cleaning">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" className="rounded-sm border border-ink/20 px-4 py-2 text-sm font-semibold"
              onClick={() => setOpen(false)}>
              Later
            </button>
            <button type="submit" disabled={busy || shop.loading}
              className="rounded-sm bg-booked px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {shop.loading ? 'Loading…' : busy ? 'Saving…' : 'Save details'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default function ShopApp({
  shopId, shopName, user, onSignOut,
}: {
  shopId?: string
  shopName?: string
  user: SupabaseUser
  onSignOut?: () => void
}) {
  const shop = useShop(shopId)
  const [branch, setBranch] = useState('All branches')
  const [tab, setTab] = useState<TabId>('requests')

  // One branch = no branch tabs. Two or more = All branches + one tab per branch.
  const multi = shop.branches.length > 1
  const branchTabs = ['All branches', ...shop.branches.map((b) => b.name)]
  const p = { shop, branch: multi ? branch : 'All branches' }

  const pages: Record<TabId, ReactNode> = {
    requests: <RequestsPage {...p} />,
    today: <TodayPage {...p} />,
    calendar: <CalendarPage branch={p.branch} shopId={shop.shopId} />,
    status: <StatusBoardPage {...p} />,
    pickup: <PickupReturnPage {...p} />,
    customers: <CustomersPage {...p} />,
    inventory: <InventoryPage {...p} />,
    costs: <CostsPage {...p} />,
    reports: <ReportsPage {...p} />,
    rules: <RulesPage {...p} />,
    messages: <ShopMessagesPage {...p} />,
    profile: <ShopProfilePage shop={shop} shopName={shopName} onSignOut={onSignOut} />,
  }
  const title =
    tab === 'messages' ? 'Messages' : tab === 'profile' ? 'Shop profile' : TABS.find((t) => t.id === tab)!.title

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-cream shadow-[0_2px_3px_rgba(63,49,43,0.25)]">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-12 py-4">
          <span className="text-xl font-semibold">Rentify.</span>
          <nav className="flex flex-1 justify-center gap-16">
            {multi ? (
              branchTabs.map((b) => (
                <button key={b} onClick={() => setBranch(b)}
                  className={`pb-0.5 text-sm font-medium ${branch === b ? 'border-b-2 border-ink' : 'border-b-2 border-transparent'}`}>
                  {b}
                </button>
              ))
            ) : (
              <span className="text-sm font-semibold">{shopName}</span>
            )}
          </nav>
          <div className="flex items-center gap-5">
            {multi && <span className="text-sm font-medium">{shopName}</span>}
            <NotificationBell
              userId={user.id}
              onOpen={(notification) => {
                if (notification.type === 'customer_message') setTab('messages')
                else if (notification.type === 'shop_extension_request') setTab('pickup')
                else if (notification.type === 'shop_message') setTab('messages')
                else setTab('requests')
              }}
            />
            <button onClick={() => setTab('messages')} title="Messages" aria-label="Messages">
              <MessageCircle size={20} fill="currentColor" />
            </button>
            <button onClick={() => setTab('profile')} title="Shop profile" aria-label="Shop profile">
              <User size={20} fill="currentColor" />
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-cream shadow-[0_2px_3px_rgba(63,49,43,0.25)]">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-12 py-4">
          {TABS.map(({ id, icon: Icon, title }) => (
            <button key={id} title={title} aria-label={title} onClick={() => setTab(id)}
              className={`pb-1 ${tab === id ? 'border-b-2 border-ink' : 'border-b-2 border-transparent'}`}>
              <Icon size={22} strokeWidth={2.4} />
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-[1440px] px-12 py-10">
        <h1 className="mb-8 inline-block border-b border-ink/30 pb-1 pr-12 text-lg font-medium">{title}</h1>
        {shop.error && <p className="mb-4 text-sm text-cleaning">{shop.error}</p>}
        {pages[tab]}
      </main>
      <ShopOwnerSetup user={user} shop={shop} />
    </div>
  )
}