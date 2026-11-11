import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  Contact, CalendarDays, CalendarRange, CalendarCheck, ArrowLeftRight,
  Users, BookOpen, BarChart3, Newspaper, TrendingUp, MessageCircle, User,
} from 'lucide-react'
import { useShop } from '../lib/shop'
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

type TabId = (typeof TABS)[number]['id'] | 'messages'

export default function ShopApp({
  shopId, shopName, onSignOut,
}: {
  shopId?: string
  shopName?: string
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
    calendar: <CalendarPage branch={p.branch} />,
    status: <StatusBoardPage {...p} />,
    pickup: <PickupReturnPage {...p} />,
    customers: <CustomersPage {...p} />,
    inventory: <InventoryPage {...p} />,
    costs: <CostsPage {...p} />,
    reports: <ReportsPage {...p} />,
    rules: <RulesPage {...p} />,
        messages: <ShopMessagesPage {...p} />,
  }
  const title = tab === 'messages' ? 'Messages' : TABS.find((t) => t.id === tab)!.title

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-t-4 border-ink bg-cream shadow-[0_2px_3px_rgba(63,49,43,0.25)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
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
            <button onClick={() => setTab('messages')} title="Messages" aria-label="Messages">
              <MessageCircle size={20} fill="currentColor" />
            </button>
            <button onClick={onSignOut} title="Sign out" aria-label="Sign out">
              <User size={20} fill="currentColor" />
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-cream shadow-[0_2px_3px_rgba(63,49,43,0.25)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-8 py-4">
          {TABS.map(({ id, icon: Icon, title }) => (
            <button key={id} title={title} aria-label={title} onClick={() => setTab(id)}
              className={`pb-1 ${tab === id ? 'border-b-2 border-ink' : 'border-b-2 border-transparent'}`}>
              <Icon size={22} strokeWidth={2.4} />
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-8 py-8">
        <h1 className="mb-8 inline-block border-b border-ink/30 pb-1 pr-12 text-lg font-medium">{title}</h1>
        {shop.error && <p className="mb-4 text-sm text-cleaning">{shop.error}</p>}
        {pages[tab]}
      </main>
    </div>
  )
}