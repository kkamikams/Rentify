import { MessageCircle, ShoppingBag, User } from 'lucide-react'

export default function CustomerHeader({
  name, showBranches, branch, branchNames, activeAccountPage, onHome, onBranchChange, onMessages, onProfile, onBookings,
}: {
  name?: string
  showBranches: boolean
  branch: string
  branchNames: string[]
  activeAccountPage?: 'profile' | 'bookings'
  onHome: () => void
  onBranchChange: (branch: string) => void
  onMessages: () => void
  onProfile: () => void
  onBookings: () => void
}) {
  return (
    <header className="bg-cream shadow-[0_2px_3px_rgba(63,49,43,0.25)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <button onClick={onHome} aria-label="Rentify home" className="text-xl font-semibold">Rentify.</button>
        {showBranches && (
          <nav className="flex gap-10 text-sm font-medium">
            {['All branches', ...branchNames].map((b) => (
              <button key={b} onClick={() => onBranchChange(b)}
                className={`pb-0.5 ${branch === b ? 'border-b-2 border-ink' : 'border-b-2 border-transparent'}`}>
                {b}
              </button>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-5">
          {name && <span className="hidden text-sm sm:inline">{name}</span>}
          <button onClick={onMessages} title="Messages" aria-label="Messages"><MessageCircle size={20} fill="currentColor" /></button>
          <button onClick={onProfile} title="My profile" aria-label="My profile"
            aria-current={activeAccountPage === 'profile' ? 'page' : undefined}
            className={activeAccountPage === 'profile' ? 'text-booked' : undefined}>
            <User size={20} fill="currentColor" />
          </button>
          <button onClick={onBookings} title="My bookings" aria-label="My bookings"
            aria-current={activeAccountPage === 'bookings' ? 'page' : undefined}
            className={activeAccountPage === 'bookings' ? 'text-booked' : undefined}>
            <ShoppingBag size={20} fill="currentColor" />
          </button>
        </div>
      </div>
    </header>
  )
}
